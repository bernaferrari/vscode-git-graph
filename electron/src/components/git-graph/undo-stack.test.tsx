/**
 * Undo Stack Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UndoStackProvider, useUndoStack, UndoStackDialog, UndoRedoButtons } from './undo-stack';
import { useAppStore } from '@/lib/store';

function Harness() {
	const stack = useUndoStack();
	return (
		<div>
			<button
				onClick={() =>
					stack.pushOperation({
						type: 'commit',
						description: 'Test commit',
						details: {},
						undoable: true,
					})
				}
			>
				Add Operation
			</button>
			<span data-testid='operation-count'>{stack.operations.length}</span>
			<span data-testid='can-undo'>{String(stack.canUndo)}</span>
			<span data-testid='can-redo'>{String(stack.canRedo)}</span>
			<button onClick={() => stack.clearHistory()}>Clear</button>
		</div>
	);
}

describe('Undo Stack', () => {
	beforeEach(() => {
		localStorage.clear();
		useAppStore.setState({ activeRepo: '/tmp/repo-under-test' });
	});

	it('provides context and tracks operations', async () => {
		render(
			<UndoStackProvider>
				<Harness />
			</UndoStackProvider>
		);

		expect(screen.getByTestId('operation-count')).toHaveTextContent('0');
		fireEvent.click(screen.getByText('Add Operation'));

		await waitFor(() => {
			expect(screen.getByTestId('operation-count')).toHaveTextContent('1');
			expect(screen.getByTestId('can-undo')).toHaveTextContent('true');
		});
	});

	it('clears history', async () => {
		render(
			<UndoStackProvider>
				<Harness />
			</UndoStackProvider>
		);

		fireEvent.click(screen.getByText('Add Operation'));
		await waitFor(() => expect(screen.getByTestId('operation-count')).toHaveTextContent('1'));

		fireEvent.click(screen.getByText('Clear'));
		await waitFor(() => {
			expect(screen.getByTestId('operation-count')).toHaveTextContent('0');
			expect(screen.getByTestId('can-undo')).toHaveTextContent('false');
		});
	});

	it('renders undo/redo buttons', () => {
		render(
			<UndoStackProvider>
				<UndoRedoButtons />
			</UndoStackProvider>
		);

		expect(screen.getByTitle(/Undo/)).toBeDefined();
		expect(screen.getByTitle(/Redo/)).toBeDefined();
	});

	it('renders undo history dialog', () => {
		render(
			<UndoStackProvider>
				<UndoStackDialog open={true} onOpenChange={() => undefined} />
			</UndoStackProvider>
		);

		expect(screen.getByText('Undo History')).toBeDefined();
	});
});
