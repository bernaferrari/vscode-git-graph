/**
 * Terminal Panel
 * Embedded terminal at bottom of window
 */

import {
	Terminal,
	X,
	Maximize2,
	Minimize2,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface TerminalPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	cwd?: string;
}

export function TerminalPanel({ open, onOpenChange, cwd }: TerminalPanelProps) {
	const { activeRepo } = useAppStore();
	const [history, setHistory] = useState<Array<{ type: 'input' | 'output' | 'error'; text: string }>>([]);
	const [commandHistory, setCommandHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState<number>(-1);
	const [input, setInput] = useState('');
	const [maximized, setMaximized] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const runTerminalCommand = trpc.system.runTerminalCommand.useMutation();

	const workingDir = cwd || activeRepo || '';

	// Scroll to bottom on new output
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [history]);

	// Focus input when opened
	useEffect(() => {
		if (open && inputRef.current) {
			inputRef.current.focus();
		}
	}, [open]);

	const executeCommand = useCallback(async (cmd: string) => {
		if (!cmd.trim()) return;

		if (cmd.trim().toLowerCase() === 'clear') {
			setHistory([]);
			return;
		}

		if (cmd.trim().toLowerCase() === 'help') {
			setHistory((prev) => [
				...prev,
				{ type: 'input', text: `$ ${cmd}` },
				{
					type: 'output',
					text: `Built-in terminal commands:
  clear   - Clear terminal output
  help    - Show this help
Any other command is executed by your system shell in the active repository.`,
				},
			]);
			return;
		}

		setHistory((prev) => [...prev, { type: 'input', text: `$ ${cmd}` }]);
		setCommandHistory((prev) => {
			if (prev[prev.length - 1] === cmd) {
				return prev;
			}
			return [...prev, cmd];
		});
		setHistoryIndex(-1);

		if (!workingDir) {
			setHistory((prev) => [...prev, { type: 'error', text: 'No active repository selected.' }]);
			return;
		}

		try {
			const result = await runTerminalCommand.mutateAsync({
				cwd: workingDir,
				command: cmd,
				timeoutMs: 60_000,
			});

			const nextEntries: Array<{ type: 'output' | 'error'; text: string }> = [];
			if (result.stdout.trim().length > 0) {
				nextEntries.push({ type: 'output', text: result.stdout.trimEnd() });
			}
			if (result.stderr.trim().length > 0) {
				nextEntries.push({ type: 'error', text: result.stderr.trimEnd() });
			}
			if (result.error && nextEntries.length === 0) {
				nextEntries.push({ type: 'error', text: result.error });
			}
			if (result.timedOut) {
				nextEntries.push({ type: 'error', text: `Command timed out after 60000ms` });
			}
			if (result.exitCode !== null && result.exitCode !== 0) {
				nextEntries.push({ type: 'error', text: `Exited with code ${result.exitCode}` });
			}

			if (nextEntries.length === 0) {
				nextEntries.push({ type: 'output', text: '(no output)' });
			}

			setHistory((prev) => [...prev, ...nextEntries]);
		} catch (error) {
			setHistory((prev) => [
				...prev,
				{ type: 'error', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
			]);
		}
	}, [runTerminalCommand, workingDir]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			executeCommand(input);
			setInput('');
			return;
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (commandHistory.length === 0) return;
			const nextIndex = historyIndex < 0 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
			setHistoryIndex(nextIndex);
			setInput(commandHistory[nextIndex] ?? '');
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (commandHistory.length === 0) return;
			if (historyIndex <= 0) {
				setHistoryIndex(-1);
				setInput('');
				return;
			}
			const nextIndex = historyIndex + 1;
			setHistoryIndex(nextIndex);
			setInput(commandHistory[nextIndex] ?? '');
		}
	};

	if (!open) return null;

	return (
		<div
			className={`border-t bg-background flex flex-col ${
				maximized ? 'absolute inset-x-0 bottom-0 h-[60vh]' : 'h-48'
			}`}
		>
			{/* Header */}
			<div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/50">
				<Terminal className="h-4 w-4 text-muted-foreground" />
				<span className="text-xs font-medium flex-1">Terminal</span>
				<span className="text-xs text-muted-foreground truncate max-w-[200px]">
					{workingDir || 'No repository selected'}
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-5 w-5 p-0"
					onClick={() => { setMaximized(!maximized); }}
				>
					{maximized ? (
						<Minimize2 className="h-3 w-3" />
					) : (
						<Maximize2 className="h-3 w-3" />
					)}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="h-5 w-5 p-0"
					onClick={() => { onOpenChange(false); }}
				>
					<X className="h-3 w-3" />
				</Button>
			</div>

			{/* Output */}
			<ScrollArea className="flex-1" ref={scrollRef}>
				<div className="p-2 font-mono text-xs">
					{history.length === 0 ? (
						<div className="text-muted-foreground">
							Terminal ready. Type 'help' for available commands.
						</div>
					) : (
						history.map((item, i) => (
							<div
								key={i}
								className={item.type === 'input'
										? 'text-foreground'
										: item.type === 'error'
											? 'text-red-500'
											: 'text-muted-foreground'}
							>
								{item.text}
							</div>
						))
					)}
				</div>
			</ScrollArea>

			{/* Input */}
			<div className="flex items-center gap-2 px-2 py-1.5 border-t">
				<span className="text-xs text-muted-foreground font-mono">$</span>
				<Input
					ref={inputRef}
					value={input}
					onChange={(e) => { setInput(e.target.value); }}
					onKeyDown={handleKeyDown}
					placeholder="Enter command..."
					disabled={runTerminalCommand.isPending}
					className="h-6 text-xs font-mono border-0 shadow-none focus-visible:ring-0 px-0"
				/>
			</div>
		</div>
	);
}
