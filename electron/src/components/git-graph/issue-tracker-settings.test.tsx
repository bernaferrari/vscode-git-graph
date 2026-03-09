import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateIssueTrackerConfig = vi.fn(async () => undefined);
const mutateIssueTrackerConfig = vi.fn();
let issueTrackerConfigData:
    | { config: { providers: Record<string, { enabled: boolean }>; autoDetect: boolean; patterns: string[] } }
    | undefined;

vi.mock('@/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            config: {
                issueTrackerConfig: {
                    invalidate: invalidateIssueTrackerConfig,
                },
            },
        }),
        config: {
            issueTrackerConfig: {
                useQuery: () => ({ data: issueTrackerConfigData }),
            },
            setIssueTrackerConfig: {
                useMutation: () => ({ mutate: mutateIssueTrackerConfig }),
            },
        },
    },
}));

import { IssueTrackerSettings } from './issue-tracker';

describe('IssueTrackerSettings', () => {
    beforeEach(() => {
        issueTrackerConfigData = {
            config: {
                providers: {
                    github: { enabled: true },
                    jira: { enabled: false },
                },
                autoDetect: true,
                patterns: ['[A-Z]{2,10}-[0-9]+', '#\\d+'],
            },
        };
        invalidateIssueTrackerConfig.mockClear();
        mutateIssueTrackerConfig.mockClear();
    });

    it('persists provider toggles through backend config mutation', async () => {
        render(<IssueTrackerSettings open={true} onOpenChange={() => undefined} />);

        fireEvent.click(screen.getByText('Jira'));

        await waitFor(() => {
            expect(mutateIssueTrackerConfig).toHaveBeenCalledWith(
                expect.objectContaining({
                    providers: expect.objectContaining({
                        jira: expect.objectContaining({ enabled: true }),
                    }),
                })
            );
        });
    });
});
