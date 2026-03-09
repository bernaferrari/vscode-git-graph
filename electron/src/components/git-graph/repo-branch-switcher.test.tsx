import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { RepoBranchSwitcher } from './repo-branch-switcher';

describe('RepoBranchSwitcher', () => {
    it('renders repo label and current branch', () => {
        render(
            <RepoBranchSwitcher
                repoLabel='my-repo'
                currentHead='main'
                branchMenuOpen={false}
                onBranchMenuOpenChange={vi.fn()}
                branchSearch=''
                onBranchSearchChange={vi.fn()}
                onBranchSearchSubmit={vi.fn()}
                filteredLocalBranches={['main', 'feature/a']}
                filteredRemoteBranches={[]}
                branchResultsEmpty={false}
                onCheckoutBranch={vi.fn()}
            />
        );

        expect(screen.getByText('my-repo')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('submits the first branch on Enter in the search input', () => {
        const onBranchSearchSubmit = vi.fn();

        render(
            <RepoBranchSwitcher
                repoLabel='my-repo'
                currentHead='main'
                branchMenuOpen={true}
                onBranchMenuOpenChange={vi.fn()}
                branchSearch='feat'
                onBranchSearchChange={vi.fn()}
                onBranchSearchSubmit={onBranchSearchSubmit}
                filteredLocalBranches={['feature/a']}
                filteredRemoteBranches={[]}
                branchResultsEmpty={false}
                onCheckoutBranch={vi.fn()}
            />
        );

        fireEvent.keyDown(screen.getByPlaceholderText('Checkout branch...'), { key: 'Enter' });

        expect(onBranchSearchSubmit).toHaveBeenCalledTimes(1);
    });
});
