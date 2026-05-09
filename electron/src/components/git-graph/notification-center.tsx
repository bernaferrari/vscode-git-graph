import { Bell, AlertCircle, AlertTriangle, CheckCheck, CheckCircle, Info, Trash2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

const TYPE_TONE: Record<
    NotificationType,
    {
        icon: typeof CheckCircle;
        cssVar: string;
        iconColor: string;
    }
> = {
    success: {
        icon: CheckCircle,
        cssVar: 'var(--success)',
        iconColor: 'color-mix(in oklch, var(--success) 72%, var(--foreground))',
    },
    warning: {
        icon: AlertTriangle,
        cssVar: 'var(--warning)',
        iconColor: 'color-mix(in oklch, var(--warning) 72%, var(--foreground))',
    },
    error: {
        icon: AlertCircle,
        cssVar: 'var(--destructive)',
        iconColor: 'var(--destructive)',
    },
    info: {
        icon: Info,
        cssVar: 'var(--info)',
        iconColor: 'color-mix(in oklch, var(--info) 72%, var(--foreground))',
    },
};

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
    const actionId = `notification-action-${String(Date.now())}-${Math.random().toString(36).slice(2, 9)}`;
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

// eslint-disable-next-line react-refresh/only-export-components
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

    const getIconNode = (type: NotificationType) => {
        const tone = TYPE_TONE[type];
        const Icon = tone.icon;
        return (
            <span
                className='grid h-7 w-7 shrink-0 place-items-center rounded-md ring-1'
                style={{
                    background: `color-mix(in oklch, ${tone.cssVar} 12%, transparent)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${tone.cssVar} 22%, transparent)`,
                }}>
                <Icon className='h-3.5 w-3.5' style={{ color: tone.iconColor }} />
            </span>
        );
    };

    const getRailColor = (type: NotificationType) => TYPE_TONE[type].cssVar;

    const formatTime = (timestamp: number) => {
        const diffMs = Date.now() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${String(diffMins)}m ago`;
        if (diffHours < 24) return `${String(diffHours)}h ago`;
        if (diffDays < 7) return `${String(diffDays)}d ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant='ghost'
                    size='sm'
                    className='relative h-8 w-8 rounded-md border border-transparent p-0 text-muted-foreground transition-all duration-150 hover:border-border/70 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]'
                    aria-label={unreadCount > 0 ? `Notifications (${String(unreadCount)} unread)` : 'Notifications'}
                    title={unreadCount > 0 ? `${String(unreadCount)} unread` : 'Notifications'}>
                    <Bell className='h-4 w-4' />
                    {unreadCount > 0 && (
                        <span className='absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground shadow-[0_0_0_2px_var(--background)]'>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className='w-[22rem] gap-0 overflow-hidden p-0' align='end'>
                <div className='flex items-center justify-between border-b border-border/60 bg-muted/15 px-4 py-2.5'>
                    <div className='flex items-center gap-2'>
                        <span className='text-[0.8125rem] font-semibold tracking-[-0.005em]'>Notifications</span>
                        {unreadCount > 0 && (
                            <Badge variant='soft' className='h-5 px-1.5 font-mono text-[10px] tabular-nums'>
                                {unreadCount} new
                            </Badge>
                        )}
                    </div>
                    <div className='flex items-center gap-0.5'>
                        {unreadCount > 0 && (
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground'
                                onClick={markAllAsRead}>
                                <CheckCheck className='h-3 w-3' />
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-6 w-6 p-0 text-muted-foreground hover:text-destructive'
                                onClick={clearAll}
                                title='Clear all'
                                aria-label='Clear notifications'>
                                <Trash2 className='h-3 w-3' />
                            </Button>
                        )}
                    </div>
                </div>

                <ScrollArea className='h-80'>
                    {notifications.length === 0 ? (
                        <div className='flex flex-col items-center justify-center px-4 py-12 text-center'>
                            <span className='mb-3 grid h-10 w-10 place-items-center rounded-lg bg-muted/60 text-muted-foreground/85 ring-1 ring-border/50'>
                                <Bell className='h-4 w-4' />
                            </span>
                            <p className='text-[0.8125rem] font-semibold tracking-[-0.005em]'>You&rsquo;re all caught up</p>
                            <p className='mt-0.5 max-w-[14rem] text-xs text-muted-foreground/85'>
                                Activity from your repos will show up here.
                            </p>
                        </div>
                    ) : (
                        <ul className='divide-y divide-border/50'>
                            {notifications.map((notification: Notification) => {
                                const action = getAction(notification.actionId);
                                const unread = !notification.read;
                                const railColor = getRailColor(notification.type);
                                return (
                                    <li
                                        key={notification.id}
                                        className={`group/notif relative px-3.5 py-2.5 transition-colors ${unread ? 'bg-[color-mix(in_oklch,var(--accent)_45%,transparent)]' : 'hover:bg-muted/40'}`}
                                        onClick={() => {
                                            if (unread) markAsRead(notification.id);
                                        }}>
                                        {unread && (
                                            <span
                                                aria-hidden
                                                className='absolute inset-y-2 left-0 w-[2px] rounded-r-full'
                                                style={{ background: railColor }}
                                            />
                                        )}
                                        <div className='flex items-start gap-2.5'>
                                            {getIconNode(notification.type)}
                                            <div className='min-w-0 flex-1 leading-tight'>
                                                <div className='flex items-start justify-between gap-2'>
                                                    <span className='line-clamp-2 text-[0.8125rem] font-semibold tracking-[-0.005em]'>
                                                        {notification.title}
                                                    </span>
                                                    <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        className='-mr-1 -mt-1 h-5 w-5 shrink-0 p-0 text-muted-foreground/70 opacity-0 transition-opacity hover:text-foreground group-hover/notif:opacity-100 focus-visible:opacity-100'
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            removeNotification(notification);
                                                        }}
                                                        aria-label={`Remove notification ${notification.title}`}>
                                                        <X className='h-3 w-3' />
                                                    </Button>
                                                </div>
                                                {notification.message && (
                                                    <p className='mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-3'>
                                                        {notification.message}
                                                    </p>
                                                )}
                                                <div className='mt-1.5 flex items-center justify-between gap-2'>
                                                    <span className='text-[10px] tabular-nums text-muted-foreground/75'>
                                                        {formatTime(notification.timestamp)}
                                                    </span>
                                                    {action && notification.actionLabel && (
                                                        <Button
                                                            variant='outline'
                                                            size='sm'
                                                            className='h-6 px-2 text-[11px]'
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
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

export default NotificationCenter;
