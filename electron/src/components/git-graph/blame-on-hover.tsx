/**
 * Blame on Hover
 * Tooltip with commit info when hovering over lines in diff
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar } from './avatar';
import { GitCommit, User, Calendar, Copy, Check } from 'lucide-react';

interface BlameInfo {
	hash: string;
	author: string;
	authorEmail: string;
	date: string;
	relativeDate: string;
	message: string;
	lineNumber: number;
}

interface BlameOnHoverProps {
	filePath: string;
	lineNumber: number;
	commitHash?: string;
	children: React.ReactNode;
	side?: 'top' | 'bottom' | 'left' | 'right';
}

// Cache for blame data
const blameCache = new Map<string, Map<number, BlameInfo>>();

export function BlameOnHover({
	filePath,
	lineNumber,
	commitHash,
	children,
	side = 'top',
}: BlameOnHoverProps) {
	const { activeRepo } = useAppStore();
	const [blameInfo, setBlameInfo] = useState<BlameInfo | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	// Cache key
	const cacheKey = `${activeRepo}-${filePath}`;

	// Fetch blame info
	useEffect(() => {
		if (!activeRepo || !filePath || !lineNumber) return;

		// Check cache first
		const fileCache = blameCache.get(cacheKey);
		if (fileCache?.has(lineNumber)) {
			setBlameInfo(fileCache.get(lineNumber)!);
			return;
		}

		// Fetch blame data
		setIsLoading(true);
		trpc.git.blame.query({
			repo: activeRepo,
			path: filePath,
			commitHash,
		})
			.then((result) => {
				if (result?.lines) {
					// Build cache for this file
					const newFileCache = new Map<number, BlameInfo>();
					
					result.lines.forEach((line: any, index: number) => {
						newFileCache.set(index + 1, {
							hash: line.hash || '',
							author: line.author || 'Unknown',
							authorEmail: line.authorEmail || '',
							date: line.date || '',
							relativeDate: formatRelativeDate(line.date),
							message: line.summary || '',
							lineNumber: index + 1,
						});
					});
					
					blameCache.set(cacheKey, newFileCache);
					
					const info = newFileCache.get(lineNumber);
					if (info) {
						setBlameInfo(info);
					}
				}
			})
			.catch(() => {
				// Silently fail
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, [activeRepo, filePath, lineNumber, commitHash, cacheKey]);

	const handleCopyHash = useCallback(() => {
		if (blameInfo?.hash) {
			navigator.clipboard.writeText(blameInfo.hash);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [blameInfo?.hash]);

	const formatRelativeDate = (dateStr: string): string => {
		if (!dateStr) return '';
		
		try {
			const date = new Date(dateStr);
			const now = new Date();
			const diffMs = now.getTime() - date.getTime();
			const diffMins = Math.floor(diffMs / 60000);
			const diffHours = Math.floor(diffMins / 60);
			const diffDays = Math.floor(diffHours / 24);
			const diffWeeks = Math.floor(diffDays / 7);
			const diffMonths = Math.floor(diffDays / 30);
			const diffYears = Math.floor(diffDays / 365);

			if (diffMins < 1) return 'just now';
			if (diffMins < 60) return `${diffMins}m ago`;
			if (diffHours < 24) return `${diffHours}h ago`;
			if (diffDays === 1) return 'yesterday';
			if (diffDays < 7) return `${diffDays}d ago`;
			if (diffWeeks === 1) return 'last week';
			if (diffWeeks < 4) return `${diffWeeks}w ago`;
			if (diffMonths === 1) return 'last month';
			if (diffMonths < 12) return `${diffMonths}mo ago`;
			if (diffYears === 1) return 'last year';
			return `${diffYears}y ago`;
		} catch {
			return dateStr;
		}
	};

	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<span className="cursor-default">{children}</span>
			</TooltipTrigger>
			<TooltipContent side={side} className="max-w-sm p-0" sideOffset={4}>
				{isLoading ? (
					<div className="p-3 text-muted-foreground text-sm">
						Loading blame...
					</div>
				) : blameInfo ? (
					<div className="p-3 space-y-2">
						{/* Author */}
						<div className="flex items-center gap-2">
							<Avatar
								email={blameInfo.authorEmail}
								name={blameInfo.author}
								size="sm"
							/>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium truncate">
									{blameInfo.author}
								</p>
								<p className="text-xs text-muted-foreground flex items-center gap-1">
									<Calendar className="h-3 w-3" />
									{blameInfo.relativeDate}
								</p>
							</div>
						</div>

						{/* Commit */}
						<div className="flex items-start gap-2">
							<div 
								className="flex items-center gap-1 cursor-pointer hover:bg-muted rounded px-1"
								onClick={handleCopyHash}
							>
								<GitCommit className="h-3 w-3 text-muted-foreground" />
								<code className="text-xs font-mono text-blue-600">
									{blameInfo.hash.slice(0, 7)}
								</code>
								{copied ? (
									<Check className="h-3 w-3 text-green-600" />
								) : (
									<Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
								)}
							</div>
						</div>

						{/* Message */}
						{blameInfo.message && (
							<p className="text-xs text-muted-foreground line-clamp-2">
								{blameInfo.message}
							</p>
						)}
					</div>
				) : (
					<div className="p-3 text-muted-foreground text-sm">
						No blame info
					</div>
				)}
			</TooltipContent>
		</Tooltip>
	);
}

// Inline blame annotation for a line
interface InlineBlameAnnotationProps {
	filePath: string;
	lineNumber: number;
	commitHash?: string;
	className?: string;
}

export function InlineBlameAnnotation({
	filePath,
	lineNumber,
	commitHash,
	className,
}: InlineBlameAnnotationProps) {
	const { activeRepo } = useAppStore();
	const [blameInfo, setBlameInfo] = useState<BlameInfo | null>(null);
	const cacheKey = `${activeRepo}-${filePath}`;

	useEffect(() => {
		const fileCache = blameCache.get(cacheKey);
		if (fileCache?.has(lineNumber)) {
			setBlameInfo(fileCache.get(lineNumber)!);
		}
	}, [cacheKey, lineNumber]);

	if (!blameInfo || blameInfo.hash === '0000000000000000000000000000000000000000') {
		return null;
	}

	return (
		<span className={cn(
			"text-xs text-muted-foreground flex items-center gap-2 pl-4",
			className
		)}>
			<Avatar
				email={blameInfo.authorEmail}
				name={blameInfo.author}
				size="sm"
				className="h-4 w-4"
			/>
			<span className="truncate max-w-[80px]">{blameInfo.author}</span>
			<span className="text-muted-foreground/60">•</span>
			<span>{blameInfo.relativeDate}</span>
		</span>
	);
}

// Hook to prefetch blame for a file
export function usePrefetchBlame(filePath: string, commitHash?: string) {
	const { activeRepo } = useAppStore();
	const cacheKey = `${activeRepo}-${filePath}`;

	useEffect(() => {
		if (!activeRepo || !filePath) return;
		if (blameCache.has(cacheKey)) return;

		trpc.git.blame.query({
			repo: activeRepo,
			path: filePath,
			commitHash,
		})
			.then((result) => {
				if (result?.lines) {
					const fileCache = new Map<number, BlameInfo>();
					
					result.lines.forEach((line: any, index: number) => {
						fileCache.set(index + 1, {
							hash: line.hash || '',
							author: line.author || 'Unknown',
							authorEmail: line.authorEmail || '',
							date: line.date || '',
							relativeDate: formatRelativeDate(line.date),
							message: line.summary || '',
							lineNumber: index + 1,
						});
					});
					
					blameCache.set(cacheKey, fileCache);
				}
			})
			.catch(() => {
				// Silently fail
			});
	}, [activeRepo, filePath, commitHash, cacheKey]);
}

function formatRelativeDate(dateStr: string): string {
	if (!dateStr) return '';
	
	try {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m`;
		if (diffHours < 24) return `${diffHours}h`;
		if (diffDays === 1) return 'yday';
		if (diffDays < 7) return `${diffDays}d`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	} catch {
		return dateStr;
	}
}

export default BlameOnHover;
