/**
 * Enhanced Diff Viewer
 * Side-by-side and unified diff with word/character-level highlighting
 */

import {
	AlignLeft,
	Columns,
	Copy,
	Check,
	Plus,
	Minus,
	Search,
	WrapText,
	Eye,
	EyeOff,
} from 'lucide-react';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toggle } from '@/components/ui/toggle';
import {
	parseDiffWithInlineDiffs,
	computeInlineDiff,
	type LineDiff,
	type DiffChar,
	DiffCharRenderer,
} from '@/lib/diff-utils';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface EnhancedDiffViewerProps {
	file: {
		path: string;
		from?: string;
		status: string;
	};
	commitHash?: string;
	onAcceptOurs?: () => void;
	onAcceptTheirs?: () => void;
}

export function EnhancedDiffViewer({ 
	file, 
	commitHash, 
	onAcceptOurs, 
	onAcceptTheirs 
}: EnhancedDiffViewerProps) {
	const { activeRepo } = useAppStore();
	const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
	const [wordDiff, setWordDiff] = useState(true);
	const [wordWrap, setWordWrap] = useState(false);
	const [showWhitespace, setShowWhitespace] = useState(false);
	const [copied, setCopied] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<number[]>([]);
	const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
	
	const leftRef = useRef<HTMLDivElement>(null);
	const rightRef = useRef<HTMLDivElement>(null);

	// Fetch diff data
	const { data: diffData, isLoading } = trpc.git.fileDiff.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: commitHash ?? 'HEAD',
			filePath: file.path,
		},
		{ enabled: !!activeRepo && !!file.path }
	);

	// Parse diff with inline word-level diffs
	const parsedDiff = useMemo(() => {
		if (!diffData?.diff) return [];
		return parseDiffWithInlineDiffs(diffData.diff);
	}, [diffData?.diff]);

	// Statistics
	const stats = useMemo(() => {
		const added = parsedDiff.filter(d => d.type === 'added').length;
		const removed = parsedDiff.filter(d => d.type === 'removed').length;
		const modified = parsedDiff.filter(d => d.type === 'modified').length;
		return { added, removed, modified, total: added + removed + modified };
	}, [parsedDiff]);

	// Search functionality
	const handleSearch = useCallback((query: string) => {
		setSearchQuery(query);
		if (!query) {
			setSearchResults([]);
			return;
		}
		
		const results: number[] = [];
		parsedDiff.forEach((line, index) => {
			const leftText = line.left?.chars?.map(c => c.char).join('') || '';
			const rightText = line.right?.chars?.map(c => c.char).join('') || '';
			if (leftText.toLowerCase().includes(query.toLowerCase()) ||
				rightText.toLowerCase().includes(query.toLowerCase())) {
				results.push(index);
			}
		});
		setSearchResults(results);
		setCurrentSearchIndex(0);
	}, [parsedDiff]);

	// Sync scroll between left and right panels
	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		if (!wordDiff) return;
		
		const source = e.currentTarget;
		const target = source === leftRef.current ? rightRef.current : leftRef.current;
		
		if (target) {
			target.scrollTop = source.scrollTop;
		}
	}, [wordDiff]);

	// Copy diff to clipboard
	const handleCopy = () => {
		navigator.clipboard.writeText(diffData?.diff ?? '');
		setCopied(true);
		setTimeout(() => { setCopied(false); }, 2000);
	};

	// Render whitespace characters
	const renderWhitespace = (text: string) => {
		if (!showWhitespace) return text;
		return text
			.replace(/ /g, '·')
			.replace(/\t/g, '→   ')
			.replace(/\n/g, '↵\n');
	};

	// Get line background class
	const getLineClass = (type: LineDiff['type']) => {
		switch (type) {
			case 'removed':
				return 'bg-red-100 dark:bg-red-900/30';
			case 'added':
				return 'bg-green-100 dark:bg-green-900/30';
			case 'modified':
				return 'bg-amber-50 dark:bg-amber-900/20';
			default:
				return '';
		}
	};

	// Render a single line's content with word-level diff highlighting
	const renderLineContent = (
		lineDiff: LineDiff, 
		side: 'left' | 'right'
	) => {
		const inline = side === 'left' ? lineDiff.left : lineDiff.right;
		if (!inline) return <span className="text-muted-foreground">{' '}</span>;
		
		if (!wordDiff || lineDiff.type === 'context') {
			return <span>{renderWhitespace(inline.chars.map(c => c.char).join(''))}</span>;
		}
		
		const baseClass = side === 'left' ? 'removed' : 'added';
		
		return (
			<span className={wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}>
				{showWhitespace ? (
					renderWhitespace(inline.chars.map(c => c.char).join(''))
				) : (
					<DiffCharRenderer chars={inline.chars} baseClass={baseClass} />
				)}
			</span>
		);
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Toolbar */}
			<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 gap-4">
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-sm font-medium truncate max-w-[200px]" title={file.path}>
						{file.path}
					</span>
					<span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">
						{file.status}
					</span>
					{stats.total > 0 && (
						<div className="flex items-center gap-1 text-xs shrink-0">
							<span className="text-red-600">-{stats.removed}</span>
							<span className="text-muted-foreground">/</span>
							<span className="text-green-600">+{stats.added + stats.modified}</span>
						</div>
					)}
				</div>
				
				<div className="flex items-center gap-1">
					{/* Search */}
					<div className="relative">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search..."
							value={searchQuery}
							onChange={(e) => { handleSearch(e.target.value); }}
							className="h-7 w-32 pl-7 pr-2 text-xs rounded border bg-background"
						/>
						{searchResults.length > 0 && (
							<span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
								{currentSearchIndex + 1}/{searchResults.length}
							</span>
						)}
					</div>
					
					{/* View mode */}
					<div className="flex items-center border rounded-md">
						<Button
							variant={viewMode === 'side-by-side' ? 'default' : 'ghost'}
							size="sm"
							className="h-7 px-2 rounded-r-none"
							onClick={() => { setViewMode('side-by-side'); }}
						>
							<Columns className="h-3 w-3" />
						</Button>
						<Button
							variant={viewMode === 'unified' ? 'default' : 'ghost'}
							size="sm"
							className="h-7 px-2 rounded-l-none"
							onClick={() => { setViewMode('unified'); }}
						>
							<AlignLeft className="h-3 w-3" />
						</Button>
					</div>
					
					{/* Word diff toggle */}
					<Toggle
						pressed={wordDiff}
						onPressedChange={setWordDiff}
						size="sm"
						className="h-7 w-7 p-0"
						title="Toggle word-level diff"
					>
						<Eye className="h-3 w-3" />
					</Toggle>
					
					{/* Word wrap toggle */}
					<Toggle
						pressed={wordWrap}
						onPressedChange={setWordWrap}
						size="sm"
						className="h-7 w-7 p-0"
						title="Toggle word wrap"
					>
						<WrapText className="h-3 w-3" />
					</Toggle>
					
					{/* Show whitespace toggle */}
					<Toggle
						pressed={showWhitespace}
						onPressedChange={setShowWhitespace}
						size="sm"
						className="h-7 w-7 p-0"
						title="Show whitespace"
					>
						{showWhitespace ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
					</Toggle>
					
					{/* Copy */}
					<Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
						{copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
					</Button>
					
					{/* Conflict resolution buttons */}
					{file.status === 'U' && (
						<>
							<Button variant="outline" size="sm" className="h-7 px-2" onClick={onAcceptOurs}>
								<Minus className="h-3 w-3 mr-1" />
								Ours
							</Button>
							<Button variant="outline" size="sm" className="h-7 px-2" onClick={onAcceptTheirs}>
								<Plus className="h-3 w-3 mr-1" />
								Theirs
							</Button>
						</>
					)}
				</div>
			</div>

			{/* Diff content */}
			<div className="flex-1 overflow-hidden">
				{viewMode === 'side-by-side' ? (
					<div className="flex h-full">
						{/* Left panel (old) */}
						<div 
							ref={leftRef}
							className="flex-1 border-r overflow-auto" 
							onScroll={handleScroll}
						>
							<div className="font-mono text-xs">
								{parsedDiff.map((line, i) => (
									<div 
										key={i} 
										className={`flex ${getLineClass(line.type)} ${
											searchResults.includes(i) ? 'ring-1 ring-yellow-400' : ''
										} ${searchResults[currentSearchIndex] === i ? 'ring-2 ring-yellow-500' : ''}`}
									>
										<div className="w-12 text-right pr-2 text-muted-foreground select-none border-r bg-muted/30 shrink-0">
											{line.leftLineNum || ''}
										</div>
										<div className="w-6 text-center select-none shrink-0 border-r bg-muted/30">
											{line.type === 'removed' && (
												<Minus className="h-3 w-3 mx-auto text-red-600" />
											)}
											{line.type === 'modified' && (
												<span className="text-amber-600">~</span>
											)}
										</div>
										<pre className={`px-2 py-0.5 flex-1 min-w-0 ${wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-hidden'}`}>
											{renderLineContent(line, 'left')}
										</pre>
									</div>
								))}
							</div>
						</div>
						
						{/* Right panel (new) */}
						<div 
							ref={rightRef}
							className="flex-1 overflow-auto"
							onScroll={handleScroll}
						>
							<div className="font-mono text-xs">
								{parsedDiff.map((line, i) => (
									<div 
										key={i} 
										className={`flex ${getLineClass(line.type)} ${
											searchResults.includes(i) ? 'ring-1 ring-yellow-400' : ''
										} ${searchResults[currentSearchIndex] === i ? 'ring-2 ring-yellow-500' : ''}`}
									>
										<div className="w-12 text-right pr-2 text-muted-foreground select-none border-r bg-muted/30 shrink-0">
											{line.rightLineNum || ''}
										</div>
										<div className="w-6 text-center select-none shrink-0 border-r bg-muted/30">
											{line.type === 'added' && (
												<Plus className="h-3 w-3 mx-auto text-green-600" />
											)}
											{line.type === 'modified' && (
												<span className="text-amber-600">~</span>
											)}
										</div>
										<pre className={`px-2 py-0.5 flex-1 min-w-0 ${wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-hidden'}`}>
											{renderLineContent(line, 'right')}
										</pre>
									</div>
								))}
							</div>
						</div>
					</div>
				) : (
					/* Unified view */
					<ScrollArea className="h-full">
						<div className="font-mono text-xs">
							{parsedDiff.map((line, i) => (
								<div 
									key={i} 
									className={`flex ${getLineClass(line.type)} ${
										searchResults.includes(i) ? 'ring-1 ring-yellow-400' : ''
									} ${searchResults[currentSearchIndex] === i ? 'ring-2 ring-yellow-500' : ''}`}
								>
									<div className="w-10 text-right pr-2 text-muted-foreground select-none border-r bg-muted/30 shrink-0">
										{line.leftLineNum || ''}
									</div>
									<div className="w-10 text-right pr-2 text-muted-foreground select-none border-r bg-muted/30 shrink-0">
										{line.rightLineNum || ''}
									</div>
									<div className="w-6 text-center select-none shrink-0 border-r bg-muted/30">
										{line.type === 'removed' && <Minus className="h-3 w-3 mx-auto text-red-600" />}
										{line.type === 'added' && <Plus className="h-3 w-3 mx-auto text-green-600" />}
										{line.type === 'modified' && <span className="text-amber-600">~</span>}
									</div>
									<pre className={`px-2 py-0.5 flex-1 min-w-0 ${wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-hidden'}`}>
										{renderLineContent(line, line.type === 'removed' || line.type === 'modified' ? 'left' : 'right')}
									</pre>
								</div>
							))}
						</div>
					</ScrollArea>
				)}
			</div>
			
			{/* Status bar */}
			<div className="flex items-center justify-between px-4 py-1 border-t bg-muted/30 text-xs text-muted-foreground">
				<div className="flex items-center gap-4">
					<span>{parsedDiff.length} lines</span>
					{wordDiff && <span className="text-green-600">Word diff enabled</span>}
				</div>
				<div className="flex items-center gap-4">
					<span className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-red-200 dark:bg-red-800" />
						Removed: {stats.removed}
					</span>
					<span className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-green-200 dark:bg-green-800" />
						Added: {stats.added}
					</span>
					<span className="flex items-center gap-1">
						<span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800" />
						Modified: {stats.modified}
					</span>
				</div>
			</div>
		</div>
	);
}

export default EnhancedDiffViewer;
