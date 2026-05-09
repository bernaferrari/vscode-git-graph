/**
 * Git Graph Find Widget
 * Clean, minimal search for commits
 */

import {
	Search,
	X,
	ArrowUp,
	ArrowDown,
	CaseSensitive,
	Regex,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FindWidgetProps {
	open: boolean;
	onClose: () => void;
	onFind: (query: string, options: FindOptions) => void;
	onFindNext: () => void;
	onFindPrevious: () => void;
	currentIndex: number;
	totalMatches: number;
}

export interface FindOptions {
	caseSensitive: boolean;
	regex: boolean;
}

export function FindWidget({
	open,
	onClose,
	onFind,
	onFindNext,
	onFindPrevious,
	currentIndex,
	totalMatches,
}: FindWidgetProps) {
	const [query, setQuery] = useState('');
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [regex, setRegex] = useState(false);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) {
				onFindPrevious();
			} else {
				onFindNext();
			}
		} else if (e.key === 'Escape') {
			onClose();
		}
	};

	const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newQuery = e.target.value;
		setQuery(newQuery);
		if (newQuery) {
			onFind(newQuery, { caseSensitive, regex });
		}
	};

	if (!open) return null;

	const hasNoMatches = query.length > 0 && totalMatches === 0;

	return (
		<div
			className="fixed top-3 right-3 z-50 flex items-center gap-0.5 rounded-lg border border-border/70 bg-popover/95 p-1 backdrop-blur"
			style={{ boxShadow: 'var(--shadow-lg)' }}>
			<Search className={`h-3.5 w-3.5 ml-1.5 mr-0.5 ${hasNoMatches ? 'text-destructive' : 'text-muted-foreground'}`} />

			<Input
				value={query}
				onChange={handleQueryChange}
				onKeyDown={handleKeyDown}
				placeholder="Find in commits…"
				className="h-7 w-56 border-0 bg-transparent px-1 text-[0.8125rem] shadow-none focus-visible:ring-0"
				autoFocus
			/>

			{query && (
				<span className={`px-2 min-w-[60px] text-center font-mono text-[10.5px] tabular-nums ${
					hasNoMatches ? 'text-destructive' : 'text-muted-foreground'
				}`}>
					{totalMatches > 0
						? `${String(currentIndex + 1)} / ${String(totalMatches)}`
						: 'No matches'}
				</span>
			)}

			<Button
				variant={caseSensitive ? 'secondary' : 'ghost'}
				size="icon-xs"
				onClick={() => {
					setCaseSensitive(!caseSensitive);
					if (query) {
						onFind(query, { caseSensitive: !caseSensitive, regex });
					}
				}}
				title="Match case"
			>
				<CaseSensitive className="h-3 w-3" />
			</Button>

			<Button
				variant={regex ? 'secondary' : 'ghost'}
				size="icon-xs"
				onClick={() => {
					setRegex(!regex);
					if (query) {
						onFind(query, { caseSensitive, regex: !regex });
					}
				}}
				title="Regular expression"
			>
				<Regex className="h-3 w-3" />
			</Button>

			<div className="w-px h-4 bg-border/70 mx-1" />

			<Button
				variant="ghost"
				size="icon-xs"
				onClick={onFindPrevious}
				disabled={totalMatches === 0}
				title="Previous match (⇧↵)"
			>
				<ArrowUp className="h-3 w-3" />
			</Button>

			<Button
				variant="ghost"
				size="icon-xs"
				onClick={onFindNext}
				disabled={totalMatches === 0}
				title="Next match (↵)"
			>
				<ArrowDown className="h-3 w-3" />
			</Button>

			<div className="w-px h-4 bg-border/70 mx-1" />

			<Button
				variant="ghost"
				size="icon-xs"
				onClick={onClose}
				title="Close (Esc)"
			>
				<X className="h-3 w-3" />
			</Button>
		</div>
	);
}
