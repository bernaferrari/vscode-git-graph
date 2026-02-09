/**
 * Git Graph Find Widget
 * Uses Shadcn input components
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';

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

	if (!open) return null;

	return (
		<div className="fixed top-2 right-2 z-50 flex items-center gap-2 rounded-lg border bg-background p-2 shadow-lg">
			<TooltipProvider>
				{/* Search Input */}
				<Input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Find in commits..."
					className="w-64"
					autoFocus
				/>

				{/* Match Count */}
				{totalMatches > 0 && (
					<Badge variant="secondary" className="shrink-0">
						{currentIndex + 1} / {totalMatches}
					</Badge>
				)}

				<Separator orientation="vertical" className="h-6" />

				{/* Case Sensitive Toggle */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={caseSensitive ? 'default' : 'ghost'}
							size="sm"
							onClick={() => {
								setCaseSensitive(!caseSensitive);
								if (query) {
									onFind(query, { caseSensitive: !caseSensitive, regex });
								}
							}}
							className="h-8 w-8 p-0"
						>
							Aa
						</Button>
					</TooltipTrigger>
					<TooltipContent>Match Case</TooltipContent>
				</Tooltip>

				{/* Regex Toggle */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={regex ? 'default' : 'ghost'}
							size="sm"
							onClick={() => {
								setRegex(!regex);
								if (query) {
									onFind(query, { caseSensitive, regex: !regex });
								}
							}}
							className="h-8 w-8 p-0 font-mono"
						>
							.*
						</Button>
					</TooltipTrigger>
					<TooltipContent>Use Regular Expression</TooltipContent>
				</Tooltip>

				<Separator orientation="vertical" className="h-6" />

				{/* Previous Match */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={onFindPrevious}
							disabled={totalMatches === 0}
							className="h-8 w-8 p-0"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<polyline points="18 15 12 9 6 15" />
							</svg>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Previous Match (Shift+Enter)</TooltipContent>
				</Tooltip>

				{/* Next Match */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={onFindNext}
							disabled={totalMatches === 0}
							className="h-8 w-8 p-0"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Next Match (Enter)</TooltipContent>
				</Tooltip>

				<Separator orientation="vertical" className="h-6" />

				{/* Close */}
				<Button
					variant="ghost"
					size="sm"
					onClick={onClose}
					className="h-8 w-8 p-0"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</Button>
			</TooltipProvider>
		</div>
	);
}
