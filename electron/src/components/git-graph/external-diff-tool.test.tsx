import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openExternalDiff } = vi.hoisted(() => ({
    openExternalDiff: vi.fn(async () => undefined),
}));
let diffConfigData:
    | { config: { tools: Array<{ id: string; name: string; command: string; args: string; supports3Way: boolean; supportsDirDiff: boolean }>; selectedTool: string; useForMergeConflicts: boolean } }
    | undefined;

vi.mock('@/trpc/client', () => ({
    trpc: {
        config: {
            externalDiffConfig: {
                useQuery: () => ({ data: diffConfigData }),
            },
        },
        git: {
            openExternalDiff: {
                mutate: openExternalDiff,
            },
        },
    },
}));

vi.mock('@/lib/store', () => ({
    useAppStore: () => ({ activeRepo: '/tmp/repo-under-test' }),
}));

import { OpenInExternalDiffButton } from './external-diff-tool';

describe('OpenInExternalDiffButton', () => {
    beforeEach(() => {
        diffConfigData = {
            config: {
                tools: [
                    {
                        id: 'meld',
                        name: 'Meld',
                        command: 'meld',
                        args: '"$LOCAL" "$REMOTE"',
                        supports3Way: true,
                        supportsDirDiff: true,
                    },
                ],
                selectedTool: 'meld',
                useForMergeConflicts: false,
            },
        };
        openExternalDiff.mockClear();
    });

    it('uses backend-backed diff config when opening external diff', async () => {
        render(<OpenInExternalDiffButton filePath='src/app.ts' commitHash='abc123' />);

        fireEvent.click(screen.getByRole('button', { name: /open externally/i }));

        await waitFor(() => {
            expect(openExternalDiff).toHaveBeenCalledWith({
                repo: '/tmp/repo-under-test',
                filePath: 'src/app.ts',
                commitHash: 'abc123',
                onCommit: undefined,
                command: 'meld',
                args: '"$LOCAL" "$REMOTE"',
            });
        });
    });
});
