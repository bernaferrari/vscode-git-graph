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

	return (
		<div className="fixed top-3 right-3 z-50 flex items-center gap-1 rounded-lg border bg-background/95 backdrop-blur shadow-lg p-1">
			{/* Search icon */}
			<Search className="h-4 w-4 text-muted-foreground ml-2 mr-1" />

			{/* Search Input */}
			<Input
				value={query}
				onChange={handleQueryChange}
				onKeyDown={handleKeyDown}
				placeholder="Find in commits..."
				className="w-56 h-8 border-0 shadow-none focus-visible:ring-0 text-sm"
				autoFocus
			/>

			{/* Match Count */}
			{query && (
				<span className="text-xs text-muted-foreground px-2 min-w-[50px] text-center">
					{totalMatches > 0 ? `${String(currentIndex + 1)}/${String(totalMatches)}` : 'No matches'}
				</span>
			)}

			{/* Case Sensitive Toggle */}
			<Button
				variant={caseSensitive ? 'secondary' : 'ghost'}
				size="sm"
				onClick={() => {
					setCaseSensitive(!caseSensitive);
					if (query) {
						onFind(query, { caseSensitive: !caseSensitive, regex });
					}
				}}
				className="h-7 w-7 p-0"
				title="Case sensitive"
			>
				<CaseSensitive className="h-4 w-4" />
			</Button>

			{/* Regex Toggle */}
			<Button
				variant={regex ? 'secondary' : 'ghost'}
				size="sm"
				onClick={() => {
					setRegex(!regex);
					if (query) {
						onFind(query, { caseSensitive, regex: !regex });
					}
				}}
				className="h-7 w-7 p-0"
				title="Regular expression"
			>
				<Regex className="h-4 w-4" />
			</Button>

			<div className="w-px h-5 bg-border mx-1" />

			{/* Previous */}
			<Button
				variant="ghost"
				size="sm"
				onClick={onFindPrevious}
				disabled={totalMatches === 0}
				className="h-7 w-7 p-0"
				title="Previous match (Shift+Enter)"
			>
				<ArrowUp className="h-4 w-4" />
			</Button>

			{/* Next */}
			<Button
				variant="ghost"
				size="sm"
				onClick={onFindNext}
				disabled={totalMatches === 0}
				className="h-7 w-7 p-0"
				title="Next match (Enter)"
			>
				<ArrowDown className="h-4 w-4" />
			</Button>

			<div className="w-px h-5 bg-border mx-1" />

			{/* Close */}
			<Button
				variant="ghost"
				size="sm"
				onClick={onClose}
				className="h-7 w-7 p-0"
				title="Close (Esc)"
			>
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
}
