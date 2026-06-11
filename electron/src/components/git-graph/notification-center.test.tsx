import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateNotifications = vi.fn(() => undefined);
const markAllNotificationsRead = vi.fn();
const removeNotification = vi.fn();
let notificationsData:
    | {
          notifications: Array<{
              id: string;
              type: 'info' | 'success' | 'warning' | 'error';
              title: string;
              timestamp: number;
              read: boolean;
              message?: string;
          }>;
      }
    | undefined;

vi.mock('@/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            config: {
                notifications: {
                    invalidate: invalidateNotifications,
                },
            },
        }),
        config: {
            notifications: {
                useQuery: () => ({ data: notificationsData }),
            },
            addNotification: {
                useMutation: () => ({ mutate: vi.fn() }),
            },
            markNotificationRead: {
                useMutation: () => ({ mutate: vi.fn() }),
            },
            markAllNotificationsRead: {
                useMutation: () => ({ mutate: markAllNotificationsRead }),
            },
            removeNotification: {
                useMutation: () => ({ mutate: removeNotification }),
            },
            clearNotifications: {
                useMutation: () => ({ mutate: vi.fn() }),
            },
        },
    },
}));

import { NotificationCenter } from './notification-center';

describe('NotificationCenter', () => {
    beforeEach(() => {
        notificationsData = {
            notifications: [
                {
                    id: 'fetch-failed',
                    type: 'warning',
                    title: 'Fetch failed',
                    message: 'origin timed out',
                    timestamp: Date.now(),
                    read: false,
                },
            ],
        };
        invalidateNotifications.mockClear();
        markAllNotificationsRead.mockClear();
        removeNotification.mockClear();
    });

    it('renders unread notifications and supports mark all read', async () => {
        render(<NotificationCenter />);

        const trigger = screen.getByRole('button', { name: /notifications/i });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        expect(trigger).toHaveTextContent('1');
        fireEvent.click(trigger);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        expect(screen.getByText('Fetch failed')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Mark all read'));

        await waitFor(() => {
            expect(markAllNotificationsRead).toHaveBeenCalled();
        });
    });
});
