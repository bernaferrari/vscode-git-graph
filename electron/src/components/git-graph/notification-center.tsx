import { Bell, AlertCircle, AlertTriangle, CheckCheck, CheckCircle, Info, Trash2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationActionInput {
    label: string;
    onClick: () => void;
}

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    timestamp: number;
    read: boolean;
    actionId?: string;
    actionLabel?: string;
}

const notificationActionRegistry = new Map<string, NotificationActionInput>();

function registerNotificationAction(action: NotificationActionInput): { actionId: string; actionLabel: string } {
    const actionId = `notification-action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    notificationActionRegistry.set(actionId, action);
    return {
        actionId,
        actionLabel: action.label,
    };
}

function unregisterNotificationAction(actionId?: string) {
    if (!actionId) {
        return;
    }
    notificationActionRegistry.delete(actionId);
}

export function useNotifications() {
    const utils = trpc.useUtils();
    const notificationsQuery = trpc.config.notifications.useQuery(undefined, { staleTime: 5_000 });
    const addNotificationMutation = trpc.config.addNotification.useMutation({
        onSuccess: async () => {
            await utils.config.notifications.invalidate();
        },
    });
    const markNotificationReadMutation = trpc.config.markNotificationRead.useMutation({
        onSuccess: async () => {
            await utils.config.notifications.invalidate();
        },
    });
    const markAllNotificationsReadMutation = trpc.config.markAllNotificationsRead.useMutation({
        onSuccess: async () => {
            await utils.config.notifications.invalidate();
        },
    });
    const removeNotificationMutation = trpc.config.removeNotification.useMutation({
        onSuccess: async () => {
            await utils.config.notifications.invalidate();
        },
    });
    const clearNotificationsMutation = trpc.config.clearNotifications.useMutation({
        onSuccess: async () => {
            await utils.config.notifications.invalidate();
        },
    });

    const notifications: Notification[] = notificationsQuery.data?.notifications ?? [];
    const unreadCount = useMemo(
        () => notifications.filter((notification: Notification) => !notification.read).length,
        [notifications]
    );

    const addNotification = useCallback(
        (notification: {
            type: NotificationType;
            title: string;
            message?: string;
            action?: NotificationActionInput;
        }) => {
            const actionMetadata = notification.action ? registerNotificationAction(notification.action) : undefined;
            addNotificationMutation.mutate({
                type: notification.type,
                title: notification.title,
                ...(notification.message ? { message: notification.message } : {}),
                ...(actionMetadata ?? {}),
            });
        },
        [addNotificationMutation]
    );

    const markAsRead = useCallback(
        (id: string) => {
            markNotificationReadMutation.mutate({ id });
        },
        [markNotificationReadMutation]
    );

    const markAllAsRead = useCallback(() => {
        markAllNotificationsReadMutation.mutate();
    }, [markAllNotificationsReadMutation]);

    const removeNotification = useCallback(
        (notification: Notification) => {
            unregisterNotificationAction(notification.actionId);
            removeNotificationMutation.mutate({ id: notification.id });
        },
        [removeNotificationMutation]
    );

    const clearAll = useCallback(() => {
        notifications.forEach((notification: Notification) => {
            unregisterNotificationAction(notification.actionId);
        });
        clearNotificationsMutation.mutate();
    }, [clearNotificationsMutation, notifications]);

    const getAction = useCallback((actionId?: string) => {
        return actionId ? notificationActionRegistry.get(actionId) : undefined;
    }, []);

    return {
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
        getAction,
    };
}

export function NotificationCenter() {
    const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll, getAction } =
        useNotifications();
    const [open, setOpen] = useState(false);

    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'success':
                return <CheckCircle className='h-4 w-4 text-green-600' />;
            case 'warning':
                return <AlertTriangle className='h-4 w-4 text-amber-600' />;
            case 'error':
                return <AlertCircle className='h-4 w-4 text-red-600' />;
            default:
                return <Info className='h-4 w-4 text-blue-600' />;
        }
    };

    const getBgColor = (type: NotificationType) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 dark:bg-green-950/30';
            case 'warning':
                return 'bg-amber-50 dark:bg-amber-950/30';
            case 'error':
                return 'bg-red-50 dark:bg-red-950/30';
            default:
                return 'bg-blue-50 dark:bg-blue-950/30';
        }
    };

    const formatTime = (timestamp: number) => {
        const diffMs = Date.now() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant='ghost'
                    size='sm'
                    className='hover:bg-accent text-muted-foreground hover:border-border/70 hover:text-foreground focus-visible:ring-primary/40 relative h-8 w-8 rounded-md border border-transparent p-0 transition-all duration-150 focus-visible:ring-2 active:scale-[0.98]'
                    aria-label='Notifications'
                    title='Notifications'>
                    <Bell className='h-4 w-4' />
                    {unreadCount > 0 && (
                        <span className='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white'>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className='w-80 p-0' align='end'>
                <div className='flex items-center justify-between border-b px-4 py-3'>
                    <div className='flex items-center gap-2'>
                        <span className='font-medium'>Notifications</span>
                        {unreadCount > 0 && (
                            <Badge variant='secondary' className='text-xs'>
                                {unreadCount} new
                            </Badge>
                        )}
                    </div>
                    <div className='flex items-center gap-1'>
                        {unreadCount > 0 && (
                            <Button variant='ghost' size='sm' className='h-7 px-2 text-xs' onClick={markAllAsRead}>
                                <CheckCheck className='mr-1 h-3 w-3' />
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-7 px-2 text-xs text-red-600'
                                onClick={clearAll}
                                aria-label='Clear notifications'>
                                <Trash2 className='h-3 w-3' />
                            </Button>
                        )}
                    </div>
                </div>

                <ScrollArea className='h-80'>
                    {notifications.length === 0 ? (
                        <div className='text-muted-foreground flex flex-col items-center justify-center py-8'>
                            <Bell className='mb-2 h-8 w-8 opacity-50' />
                            <p className='text-sm'>No notifications</p>
                        </div>
                    ) : (
                        <div className='divide-y'>
                            {notifications.map((notification: Notification) => {
                                const action = getAction(notification.actionId);
                                return (
                                    <div
                                        key={notification.id}
                                        className={`p-3 ${!notification.read ? getBgColor(notification.type) : ''}`}
                                        onClick={() => {
                                            if (!notification.read) {
                                                markAsRead(notification.id);
                                            }
                                        }}>
                                        <div className='flex items-start gap-3'>
                                            {getIcon(notification.type)}
                                            <div className='min-w-0 flex-1'>
                                                <div className='mb-1 flex items-center justify-between gap-2'>
                                                    <span className='truncate text-sm font-medium'>{notification.title}</span>
                                                    <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        className='h-5 w-5 p-0'
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            removeNotification(notification);
                                                        }}
                                                        aria-label={`Remove notification ${notification.title}`}>
                                                        <X className='h-3 w-3' />
                                                    </Button>
                                                </div>
                                                {notification.message && (
                                                    <p className='text-muted-foreground mb-2 text-xs'>
                                                        {notification.message}
                                                    </p>
                                                )}
                                                <div className='flex items-center justify-between gap-2'>
                                                    <span className='text-muted-foreground text-xs'>
                                                        {formatTime(notification.timestamp)}
                                                    </span>
                                                    {action && notification.actionLabel && (
                                                        <Button
                                                            variant='outline'
                                                            size='sm'
                                                            className='h-6 px-2 text-xs'
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                markAsRead(notification.id);
                                                                action.onClick();
                                                                setOpen(false);
                                                            }}>
                                                            {notification.actionLabel}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

export default NotificationCenter;
