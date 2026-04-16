import { useCallback } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/trpc/client';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotifyOptions {
    description?: string;
    persist?: boolean;
}

export function useAppNotifications() {
    const utils = trpc.useUtils();
    const addNotificationMutation = trpc.config.addNotification.useMutation({
        onSuccess: async () => {
            await utils.config.notifications.invalidate();
        },
    });

    const notify = useCallback(
        (type: NotificationType, title: string, options?: NotifyOptions) => {
            const description = options?.description;
            switch (type) {
                case 'success':
                    toast.success(title, description ? { description } : undefined);
                    break;
                case 'warning':
                    toast.warning(title, description ? { description } : undefined);
                    break;
                case 'error':
                    toast.error(title, description ? { description } : undefined);
                    break;
                default:
                    toast.info(title, description ? { description } : undefined);
                    break;
            }

            if (options?.persist !== false) {
                addNotificationMutation.mutate({
                    type,
                    title,
                    ...(description ? { message: description } : {}),
                });
            }
        },
        [addNotificationMutation]
    );

    return {
        notify,
        notifySuccess: useCallback((title: string, options?: NotifyOptions) => { notify('success', title, options); }, [notify]),
        notifyWarning: useCallback((title: string, options?: NotifyOptions) => { notify('warning', title, options); }, [notify]),
        notifyError: useCallback((title: string, options?: NotifyOptions) => { notify('error', title, options); }, [notify]),
        notifyInfo: useCallback((title: string, options?: NotifyOptions) => { notify('info', title, options); }, [notify]),
    };
}

export default useAppNotifications;
