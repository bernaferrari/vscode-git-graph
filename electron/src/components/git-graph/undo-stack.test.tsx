/**
 * Undo Stack Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UndoStackProvider, useUndoStack, UndoStackDialog, UndoRedoButtons } from './undo-stack';

// Test component to access undo stack context
function TestComponent({ onAction }: { onAction: (stack: ReturnType<typeof useUndoStack>) => void }) {
	const stack = useUndoStack();
	return (
		<div>
			<button onClick={() => onAction(stack)}>Trigger</button>
			<span data-testid="undo-count">{stack.undoStack.length}</span>
			<span data-testid="redo-count">{stack.redoStack.length}</span>
			<span data-testid="can-undo">{stack.canUndo.toString()}</span>
			<span data-testid="can-redo">{stack.canRedo.toString()}</span>
		</div>
	);
}

describe('Undo Stack', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	describe('UndoStackProvider', () => {
		it('should provide undo stack context', () => {
			render(
				<UndoStackProvider repoPath="/test/repo">
					<TestComponent onAction={() => {}} />
				</UndoStackProvider>
			);

			expect(screen.getByTestId('undo-count')).toHaveTextContent('0');
			expect(screen.getByTestId('redo-count')).toHaveTextContent('0');
		});

		it('should track operations', async () => {
			render(
				<UndoStackProvider repoPath="/test/repo">
					<TestComponent onAction={(stack) => {
						stack.recordOperation({
							type: 'commit',
							description: 'Test commit',
							hash: 'abc123',
							undoData: { commitHash: 'abc123' },
						});
					}} />
				</UndoStackProvider>
			);

			fireEvent.click(screen.getByText('Trigger'));

			await waitFor(() => {
				expect(screen.getByTestId('undo-count')).toHaveTextContent('1');
			});
		});

		it('should support undo', async () => {
			render(
				<UndoStackProvider repoPath="/test/repo">
					<TestComponent onAction={(stack) => {
						stack.recordOperation({
							type: 'commit',
							description: 'Test commit',
							hash: 'abc123',
							undoData: { commitHash: 'abc123' },
						});
						setTimeout(() => stack.undo(), 0);
					}} />
				</UndoStackProvider>
			);

			fireEvent.click(screen.getByText('Trigger'));

			await waitFor(() => {
				expect(screen.getByTestId('undo-count')).toHaveTextContent('0');
				expect(screen.getByTestId('redo-count')).toHaveTextContent('1');
			});
		});

		it('should support redo', async () => {
			render(
				<UndoStackProvider repoPath="/test/repo">
					<TestComponent onAction={async (stack) => {
						stack.recordOperation({
							type: 'commit',
							description: 'Test commit',
							hash: 'abc123',
							undoData: { commitHash: 'abc123' },
						});
						await stack.undo();
						await stack.redo();
					}} />
				</UndoStackProvider>
			);

			fireEvent.click(screen.getByText('Trigger'));

			await waitFor(() => {
				expect(screen.getByTestId('undo-count')).toHaveTextContent('1');
				expect(screen.getByTestId('redo-count')).toHaveTextContent('0');
			});
		});

		it('should persist to localStorage', async () => {
			const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

			render(
				<UndoStackProvider repoPath="/test/repo">
					<TestComponent onAction={(stack) => {
						stack.recordOperation({
							type: 'commit',
							description: 'Test commit',
							hash: 'abc123',
							undoData: { commitHash: 'abc123' },
						});
					}} />
				</UndoStackProvider>
			);

			fireEvent.click(screen.getByText('Trigger'));

			await waitFor(() => {
				expect(setItemSpy).toHaveBeenCalledWith(
					'git-graph-undo-/test/repo',
					expect.any(String)
				);
			});
		});

		it('should clear history', async () => {
			render(
				<UndoStackProvider repoPath="/test/repo">
					<TestComponent onAction={(stack) => {
						stack.recordOperation({
							type: 'commit',
							description: 'Test commit',
							hash: 'abc123',
							undoData: { commitHash: 'abc123' },
						});
						setTimeout(() => stack.clearHistory(), 0);
					}} />
				</UndoStackProvider>
			);

			fireEvent.click(screen.getByText('Trigger'));

			await waitFor(() => {
				expect(screen.getByTestId('undo-count')).toHaveTextContent('0');
				expect(screen.getByTestId('redo-count')).toHaveTextContent('0');
			});
		});
	});

	describe('UndoRedoButtons', () => {
		it('should render undo and redo buttons', () => {
			render(
				<UndoStackProvider repoPath="/test/repo">
					<UndoRedoButtons />
				</UndoStackProvider>
			);

			expect(screen.getByTitle('Undo')).toBeDefined();
			expect(screen.getByTitle('Redo')).toBeDefined();
		});

		it('should disable buttons when no history', () => {
			render(
				<UndoStackProvider repoPath="/test/repo">
					<UndoRedoButtons />
				</UndoStackProvider>
			);

			const undoButton = screen.getByTitle('Undo');
			const redoButton = screen.getByTitle('Redo');

			expect(undoButton).toBeDisabled();
			expect(redoButton).toBeDisabled();
		});
	});

	describe('UndoStackDialog', () => {
		it('should render dialog with history', async () => {
			render(
				<UndoStackProvider repoPath="/test/repo">
					<TestComponent onAction={(stack) => {
						stack.recordOperation({
							type: 'commit',
							description: 'Test commit',
							hash: 'abc123',
							undoData: { commitHash: 'abc123' },
						});
					}} />
					<UndoStackDialog open={true} onOpenChange={() => {}} />
				</UndoStackProvider>
			);

			fireEvent.click(screen.getByText('Trigger'));

			await waitFor(() => {
				expect(screen.getByText('Undo History')).toBeDefined();
			});
		});
	});
});
