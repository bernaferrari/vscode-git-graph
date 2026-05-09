/**
 * useOutcomePicker — the cards-not-verbs hook.
 *
 * Two open paths share one provider:
 *
 * - {@link openIntegration} for "bring branch into branch". Picker shows
 *   three single-source cards (merge / rebase / squash).
 *
 * - {@link openBatch} for "do something to these N selected commits". Picker
 *   shows three batch cards (cherry-pick / squash-batch / drop). Validity
 *   constraints (contiguity, current-branch membership) come in via flags
 *   so each callsite can decide what's offered.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import {
	OutcomePicker,
	type BatchOption,
	type BatchStrategy,
	type IntegrationOption,
	type IntegrationStrategy,
} from './OutcomePicker';

import type { ReactNode } from 'react';

interface IntegrationHandlers {
	merge: (branch: string, options?: { noFastForward?: boolean; squash?: boolean; noCommit?: boolean }) => Promise<unknown>;
	rebase: (onto: string, interactive?: boolean) => Promise<unknown>;
	cherryPick?: (commitHash: string) => Promise<unknown>;
	resetMixed?: (commitHash: string) => Promise<unknown>;
	squashCommits?: (commitHashes: string[]) => Promise<unknown>;
	dropCommits?: (commitHashes: string[]) => Promise<unknown>;
}

interface OpenIntegrationArgs {
	source: string;
	target: string;
	options?: Partial<Record<IntegrationStrategy, Partial<IntegrationOption>>>;
}

interface OpenBatchArgs {
	commits: { hash: string; message: string }[];
	target: string;
	/** Are the commits contiguous on the current branch? Drives squash + drop. */
	contiguous?: boolean;
	/** Is the entire selection on the current branch? Drives squash + drop. */
	onCurrentBranch?: boolean;
	/** Optional override per-strategy. */
	options?: Partial<Record<BatchStrategy, Partial<BatchOption>>>;
}

interface OutcomePickerContextValue {
	openIntegration: (args: OpenIntegrationArgs) => void;
	openBatch: (args: OpenBatchArgs) => void;
}

const OutcomePickerContext = createContext<OutcomePickerContextValue | null>(null);

interface OutcomePickerProviderProps {
	handlers: IntegrationHandlers;
	children: ReactNode;
}

type PickerState =
	| {
			kind: 'integration';
			source: string;
			target: string;
			options: IntegrationOption[];
	  }
	| {
			kind: 'batch';
			commits: { hash: string; message: string }[];
			target: string;
			options: BatchOption[];
	  };

export function OutcomePickerProvider({ handlers, children }: OutcomePickerProviderProps) {
	const [state, setState] = useState<PickerState | null>(null);
	const [loading, setLoading] = useState(false);

	const openIntegration = useCallback((args: OpenIntegrationArgs) => {
		const baseOptions: IntegrationOption[] = [
			{
				strategy: 'merge',
				conflicts: 0,
				willRewriteHistory: false,
				commitsAfter: 1,
				recommended: true,
			},
			{
				strategy: 'rebase',
				conflicts: 0,
				willRewriteHistory: true,
				commitsAfter: 0,
			},
			{
				strategy: 'squash',
				conflicts: 0,
				willRewriteHistory: false,
				commitsAfter: 1,
			},
		];
		const overlaid = baseOptions.map((opt) => ({
			...opt,
			...args.options?.[opt.strategy],
		}));
		setState({
			kind: 'integration',
			source: args.source,
			target: args.target,
			options: overlaid,
		});
	}, []);

	const openBatch = useCallback((args: OpenBatchArgs) => {
		const { contiguous = false, onCurrentBranch = false } = args;
		const baseOptions: BatchOption[] = [
			{
				strategy: 'cherry-pick',
				conflicts: 0,
				willRewriteHistory: false,
				disabled: !handlers.cherryPick,
				disabledReason: !handlers.cherryPick ? 'Cherry-pick is unavailable for this repository.' : undefined,
				recommended: true,
			},
			{
				strategy: 'squash-batch',
				conflicts: 0,
				willRewriteHistory: true,
				disabled: !(handlers.squashCommits && contiguous && onCurrentBranch),
				disabledReason:
					!handlers.squashCommits
						? 'Squash is unavailable for this repository.'
						: !onCurrentBranch
						? 'Squash only applies to commits on the current branch.'
						: !contiguous
							? 'Select contiguous commits to squash them together.'
							: undefined,
			},
			{
				strategy: 'drop',
				conflicts: 0,
				willRewriteHistory: true,
				disabled: !(handlers.dropCommits && onCurrentBranch),
				disabledReason: !handlers.dropCommits
					? 'Drop is unavailable for this repository.'
					: !onCurrentBranch
					? 'Dropping commits rewrites the current branch — switch to it first.'
					: undefined,
			},
		];
		const overlaid = baseOptions.map((opt) => ({
			...opt,
			...args.options?.[opt.strategy],
		}));
		setState({
			kind: 'batch',
			commits: args.commits,
			target: args.target,
			options: overlaid,
		});
	}, [handlers.cherryPick, handlers.dropCommits, handlers.squashCommits]);

	const close = useCallback(() => {
		setState(null);
	}, []);

	const handleApplyIntegration = useCallback(
		async (strategy: IntegrationStrategy) => {
			if (!state || state.kind !== 'integration') return;
			setLoading(true);
			try {
				if (strategy === 'merge') {
					await handlers.merge(state.source, { noFastForward: true });
				} else if (strategy === 'rebase') {
					await handlers.rebase(state.source);
				} else {
					await handlers.merge(state.source, { squash: true, noFastForward: false, noCommit: false });
				}
				close();
			} finally {
				setLoading(false);
			}
		},
		[handlers, state, close]
	);

	const handleApplyBatch = useCallback(
		async (
			strategy: BatchStrategy,
			orderedCommits: { hash: string; message: string }[],
		) => {
			if (!state || state.kind !== 'batch') return;
			setLoading(true);
			try {
				if (strategy === 'cherry-pick') {
					if (handlers.cherryPick) {
						for (const commit of orderedCommits) {
							await handlers.cherryPick(commit.hash);
						}
					}
				} else if (strategy === 'squash-batch') {
					await handlers.squashCommits?.(orderedCommits.map((commit) => commit.hash));
				} else if (strategy === 'drop') {
					await handlers.dropCommits?.(orderedCommits.map((commit) => commit.hash));
				}
				close();
			} finally {
				setLoading(false);
			}
		},
		[handlers, state, close]
	);

	const value = useMemo(() => ({ openIntegration, openBatch }), [openIntegration, openBatch]);

	return (
		<OutcomePickerContext.Provider value={value}>
			{children}
			{state?.kind === 'integration' ? (
				<OutcomePicker
					mode='single'
					open
					onOpenChange={(open) => {
						if (!open) close();
					}}
					sourceRef={state.source}
					targetRef={state.target}
					options={state.options}
					onApply={(strategy) => { void handleApplyIntegration(strategy); }}
					loading={loading}
				/>
			) : null}
			{state?.kind === 'batch' ? (
				<OutcomePicker
					mode='batch'
					open
					onOpenChange={(open) => {
						if (!open) close();
					}}
					commits={state.commits}
					targetRef={state.target}
					options={state.options}
					onApply={(strategy, orderedCommits) => { void handleApplyBatch(strategy, orderedCommits); }}
					loading={loading}
				/>
			) : null}
		</OutcomePickerContext.Provider>
	);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOutcomePicker(): OutcomePickerContextValue {
	const context = useContext(OutcomePickerContext);
	if (!context) {
		return {
			openIntegration: () => {
				if (process.env.NODE_ENV !== 'production') {
					console.warn('[useOutcomePicker] called outside of OutcomePickerProvider');
				}
			},
			openBatch: () => {
				if (process.env.NODE_ENV !== 'production') {
					console.warn('[useOutcomePicker] called outside of OutcomePickerProvider');
				}
			},
		};
	}
	return context;
}
