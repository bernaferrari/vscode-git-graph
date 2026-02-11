/**
 * Notification Center
 * Centralized notification management
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Bell,
	Check,
	X,
	AlertTriangle,
	CheckCircle,
	Info,
	AlertCircle,
	Trash2,
	CheckCheck,
} from 'lucide-react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	message?: string;
	timestamp: number;
	read: boolean;
	action?: {
		label: string;
		onClick: () => void;
	};
}

interface NotificationContextType {
	notifications: Notification[];
	addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
	markAsRead: (id: string) => void;
	markAllAsRead: () => void;
	removeNotification: (id: string) => void;
	clearAll: () => void;
	unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const STORAGE_KEY = 'git-graph-notifications';

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [notifications, setNotifications] = useState<Notification[]>([]);

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				setNotifications(JSON.parse(stored));
			} catch {
				setNotifications([]);
			}
		}
	}, []);

	useEffect(() => {
		// Keep only last 50 notifications
		const toStore = notifications.slice(0, 50);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	}, [notifications]);

	const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
		const newNotification: Notification = {
			...notification,
			id: Date.now().toString(),
			timestamp: Date.now(),
			read: false,
		};
		setNotifications(prev => [newNotification, ...prev]);
	};

	const markAsRead = (id: string) => {
		setNotifications(prev => prev.map(n => 
			n.id === id ? { ...n, read: true } : n
		));
	};

	const markAllAsRead = () => {
		setNotifications(prev => prev.map(n => ({ ...n, read: true })));
	};

	const removeNotification = (id: string) => {
		setNotifications(prev => prev.filter(n => n.id !== id));
	};

	const clearAll = () => {
		setNotifications([]);
	};

	const unreadCount = notifications.filter(n => !n.read).length;

	return (
		<NotificationContext.Provider value={{
			notifications,
			addNotification,
			markAsRead,
			markAllAsRead,
			removeNotification,
			clearAll,
			unreadCount,
		}}>
			{children}
		</NotificationContext.Provider>
	);
}

export function useNotifications() {
	const context = useContext(NotificationContext);
	if (!context) {
		throw new Error('useNotifications must be used within NotificationProvider');
	}
	return context;
}

export function NotificationCenter() {
	const { 
		notifications, 
		markAsRead, 
		markAllAsRead, 
		removeNotification, 
		clearAll,
		unreadCount 
	} = useNotifications();
	const [open, setOpen] = useState(false);

	const getIcon = (type: NotificationType) => {
		switch (type) {
			case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
			case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
			case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />;
			default: return <Info className="h-4 w-4 text-blue-600" />;
		}
	};

	const getBgColor = (type: NotificationType) => {
		switch (type) {
			case 'success': return 'bg-green-50 dark:bg-green-950/30';
			case 'warning': return 'bg-amber-50 dark:bg-amber-950/30';
			case 'error': return 'bg-red-50 dark:bg-red-950/30';
			default: return 'bg-blue-50 dark:bg-blue-950/30';
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
				<Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative">
					<Bell className="h-4 w-4" />
					{unreadCount > 0 && (
						<span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] flex items-center justify-center text-white">
							{unreadCount > 9 ? '9+' : unreadCount}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="end">
				<div className="flex items-center justify-between px-4 py-3 border-b">
					<div className="flex items-center gap-2">
						<span className="font-medium">Notifications</span>
						{unreadCount > 0 && (
							<Badge variant="secondary" className="text-xs">
								{unreadCount} new
							</Badge>
						)}
					</div>
					<div className="flex items-center gap-1">
						{unreadCount > 0 && (
							<Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllAsRead}>
								<CheckCheck className="h-3 w-3 mr-1" />
								Mark all read
							</Button>
						)}
						{notifications.length > 0 && (
							<Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-600" onClick={clearAll}>
								<Trash2 className="h-3 w-3" />
							</Button>
						)}
					</div>
				</div>

				<ScrollArea className="h-80">
					{notifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
							<Bell className="h-8 w-8 mb-2 opacity-50" />
							<p className="text-sm">No notifications</p>
						</div>
					) : (
						<div className="divide-y">
							{notifications.map((notification) => (
								<div
									key={notification.id}
									className={`p-3 ${!notification.read ? getBgColor(notification.type) : ''}`}
									onClick={() => markAsRead(notification.id)}
								>
									<div className="flex items-start gap-3">
										{getIcon(notification.type)}
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between mb-1">
												<span className="text-sm font-medium truncate">
													{notification.title}
												</span>
												<Button
													variant="ghost"
													size="sm"
													className="h-5 w-5 p-0"
													onClick={(e) => {
														e.stopPropagation();
														removeNotification(notification.id);
													}}
												>
													<X className="h-3 w-3" />
												</Button>
											</div>
											{notification.message && (
												<p className="text-xs text-muted-foreground mb-2">
													{notification.message}
												</p>
											)}
											<div className="flex items-center justify-between">
												<span className="text-xs text-muted-foreground">
													{formatTime(notification.timestamp)}
												</span>
												{notification.action && (
													<Button
														variant="outline"
														size="sm"
														className="h-6 px-2 text-xs"
														onClick={() => {
															notification.action!.onClick();
															setOpen(false);
														}}
													>
														{notification.action.label}
													</Button>
												)}
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}

export default NotificationCenter;
