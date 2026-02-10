/**
 * Terminal Panel
 * Embedded terminal at bottom of window
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Terminal,
	X,
	Maximize2,
	Minimize2,
	ChevronUp,
	ChevronDown,
} from 'lucide-react';

interface TerminalPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	cwd?: string;
}

export function TerminalPanel({ open, onOpenChange, cwd }: TerminalPanelProps) {
	const { activeRepo } = useAppStore();
	const [history, setHistory] = useState<Array<{ type: 'input' | 'output'; text: string }>>([]);
	const [input, setInput] = useState('');
	const [maximized, setMaximized] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const workingDir = cwd || activeRepo || '~';

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

		setHistory((prev) => [...prev, { type: 'input', text: `$ ${cmd}` }]);

		// Simple command handling (in a real app, this would go through electron IPC)
		try {
			// For now, just simulate some common commands
			const parts = cmd.trim().split(' ');
			const command = parts[0];

			let output = '';

			if (command === 'clear') {
				setHistory([]);
				return;
			} else if (command === 'pwd') {
				output = workingDir;
			} else if (command === 'ls' || command === 'dir') {
				output = '(Directory listing would appear here)';
			} else if (command === 'git') {
				output = `(Git command: ${parts.slice(1).join(' ')})`;
			} else if (command === 'echo') {
				output = parts.slice(1).join(' ');
			} else if (command === 'help') {
				output = `Available commands:
  clear   - Clear terminal
  pwd     - Print working directory
  ls      - List files
  git     - Git commands
  echo    - Print text
  help    - Show this help`;
			} else {
				output = `Command not found: ${command}`;
			}

			setHistory((prev) => [...prev, { type: 'output', text: output }]);
		} catch (error) {
			setHistory((prev) => [
				...prev,
				{ type: 'output', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
			]);
		}
	}, [workingDir]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			executeCommand(input);
			setInput('');
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
					{workingDir}
				</span>
				<Button
					variant="ghost"
					size="sm"
					className="h-5 w-5 p-0"
					onClick={() => setMaximized(!maximized)}
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
					onClick={() => onOpenChange(false)}
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
								className={`${
									item.type === 'input' ? 'text-foreground' : 'text-muted-foreground'
								}`}
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
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Enter command..."
					className="h-6 text-xs font-mono border-0 shadow-none focus-visible:ring-0 px-0"
				/>
			</div>
		</div>
	);
}
