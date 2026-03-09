import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RepoAttentionSummary } from './side-panel';

describe('RepoAttentionSummary', () => {
    it('renders repo attention chips and status signals', () => {
        render(
            <RepoAttentionSummary
                dirtyCount={3}
                ahead={2}
                behind={1}
                openPullRequests={4}
                needsAttention={true}
                stale={true}
                statusSignals={['review stale', 'merge blocked']}
            />
        );

        expect(screen.getByText('Repo attention')).toBeInTheDocument();
        expect(screen.getByText('3 changed')).toBeInTheDocument();
        expect(screen.getByText('2 ahead')).toBeInTheDocument();
        expect(screen.getByText('1 behind')).toBeInTheDocument();
        expect(screen.getByText('4 PR')).toBeInTheDocument();
        expect(screen.getAllByText('stale').length).toBeGreaterThan(0);
        expect(screen.getByText('review stale')).toBeInTheDocument();
        expect(screen.getByText('merge blocked')).toBeInTheDocument();
    });

    it('renders nothing when there is no attention state', () => {
        const { container } = render(
            <RepoAttentionSummary
                dirtyCount={0}
                ahead={0}
                behind={0}
                openPullRequests={0}
                needsAttention={false}
                stale={false}
                statusSignals={[]}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });
});
