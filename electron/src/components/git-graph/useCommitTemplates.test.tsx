import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateCommitTemplates = vi.fn(() => undefined);
const mutateCommitTemplates = vi.fn();
let commitTemplatesData: { templates: Array<{ id: string; name: string; content: string; description?: string; isDefault?: boolean }> } | undefined;
let commitTemplatesSuccess = false;

vi.mock('@/trpc/client', () => ({
    trpc: {
        useUtils: () => ({
            config: {
                commitTemplates: {
                    invalidate: invalidateCommitTemplates,
                },
            },
        }),
        config: {
            commitTemplates: {
                useQuery: () => ({ data: commitTemplatesData, isSuccess: commitTemplatesSuccess }),
            },
            setCommitTemplates: {
                useMutation: () => ({
                    mutate: mutateCommitTemplates,
                }),
            },
        },
    },
}));

import { useCommitTemplates } from './useCommitTemplates';

function Harness() {
    const { templates, setTemplates } = useCommitTemplates();
    return (
        <div>
            <span data-testid='template-count'>{templates.length}</span>
            <button
                onClick={() => {
                    setTemplates([
                        { id: 'custom', name: 'Custom', content: 'feat: x', description: 'desc' },
                    ]);
                }}>
                Save Templates
            </button>
        </div>
    );
}

describe('useCommitTemplates', () => {
    beforeEach(() => {
        commitTemplatesData = undefined;
        commitTemplatesSuccess = false;
        invalidateCommitTemplates.mockClear();
        mutateCommitTemplates.mockClear();
    });

    it('hydrates from backend templates and persists changes', async () => {
        commitTemplatesData = {
            templates: [{ id: 'feat', name: 'Feature', content: 'feat: ', isDefault: true }],
        };
        commitTemplatesSuccess = true;

        render(<Harness />);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        expect(screen.getByTestId('template-count')).toHaveTextContent('1');

        fireEvent.click(screen.getByText('Save Templates'));

        await waitFor(() => {
            expect(mutateCommitTemplates).toHaveBeenCalledWith({
                templates: [{ id: 'custom', name: 'Custom', content: 'feat: x', description: 'desc' }],
            });
        });
    });
});
