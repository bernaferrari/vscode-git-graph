/**
 * UndoToastHost — universal one-tap undo.
 *
 * Watches the UndoStack for newly-pushed undoable operations and surfaces a
 * single dismissible sonner toast for ~6 seconds with an "Undo" action.
 * After it disappears the operation is still reachable from the Activity
 * panel via UndoStackDialog. macOS-style "Move to Trash" pattern: ambient,
 * cheap to ignore, one-key recovery if you actually want it.
 */

import { Undo } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useUndoStack } from './undo-stack-provider';

const UNDO_TOAST_DURATION_MS = 6000;

const UNDO_LABELS: Record<string, string> = {
	commit: 'commit',
	amend: 'amend',
	branch_create: 'branch creation',
	branch_delete: 'branch deletion',
	branch_rename: 'branch rename',
	checkout: 'checkout',
	merge: 'merge',
	rebase: 'rebase',
	cherry_pick: 'cherry-pick',
	revert: 'revert',
	reset: 'reset',
	stash_push: 'stash',
	stash_pop: 'stash pop',
	stash_drop: 'stash drop',
	tag_create: 'tag',
	tag_delete: 'tag deletion',
	push: 'push',
	pull: 'pull',
	fetch: 'fetch',
	remote_add: 'remote add',
	remote_remove: 'remote removal',
	clean: 'clean',
};

const SUPPORTED_UNDO_TYPES = new Set([
	'commit',
	'amend',
	'branch_create',
	'checkout',
	'stash_push',
]);

export function UndoToastHost() {
	const { operations, undoOperation, isUndoing } = useUndoStack();
	const seenIdsRef = useRef<Set<string>>(new Set());
	const isUndoingRef = useRef(isUndoing);
	isUndoingRef.current = isUndoing;

	useEffect(() => {
		if (operations.length === 0) {
			return;
		}

		const latest = operations[operations.length - 1];
		if (!latest) return;
		if (seenIdsRef.current.has(latest.id)) {
			return;
		}
		// First mount: prime the seen set with everything that's already there.
		if (seenIdsRef.current.size === 0) {
			for (const op of operations) {
				seenIdsRef.current.add(op.id);
			}
			return;
		}

		seenIdsRef.current.add(latest.id);

		// Skip operations that already came in undone (e.g. hydrated from server).
		if (latest.undone) {
			return;
		}

		const friendly = UNDO_LABELS[String(latest.type)] ?? String(latest.type).replace(/_/g, ' ');
		const canUndo = latest.undoable && SUPPORTED_UNDO_TYPES.has(String(latest.type));

		toast(
			latest.description || `Recorded ${friendly}`,
			{
				duration: UNDO_TOAST_DURATION_MS,
				icon: <Undo className='h-4 w-4 text-primary' />,
				action: canUndo
					? {
							label: 'Undo',
							onClick: () => {
								if (isUndoingRef.current) return;
								void undoOperation(latest.id);
							},
					  }
					: undefined,
				description: canUndo ? undefined : 'Saved to Activity history.',
			}
		);
	}, [operations, undoOperation]);

	return null;
}
