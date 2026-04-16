/**
 * Inline Blame Annotations
 * Show git blame info inline in code views
 */

import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { User, Calendar, GitCommit, Copy, Check } from 'lucide-react';

interface BlameLine {
	lineNumber: number;
	content: string;
	hash: string;
	author: string;
	authorMail: string;
	authorTime: number;
	summary: string;
}

interface InlineBlameProps {
	filePath: string;
	fileContent: string;
	onCommitClick?: (hash: string) => void;
}

// Parse git blame porcelain output
function parseBlamePorcelain(output: string): BlameLine[] {
	const result: BlameLine[] = [];
	let currentBlock: Partial<BlameLine> = {};
	let lineNumber = 0;
	
	for (const line of output.split('\n')) {
		if (line.startsWith('author ')) {
			currentBlock.author = line.substring(7);
		} else if (line.startsWith('author-mail ')) {
			currentBlock.authorMail = line.substring(12).replace(/[<>]/g, '');
		} else if (line.startsWith('author-time ')) {
			currentBlock.authorTime = parseInt(line.substring(12), 10);
		} else if (line.startsWith('summary ')) {
			currentBlock.summary = line.substring(8);
		} else if (line.match(/^[a-f0-9]{40}/)) {
			// New block starts with a hash
			const hashMatch = line.match(/^([a-f0-9]+)/);
			const hash = hashMatch?.[1];
			if (!hash) {
				continue;
			}
			if (currentBlock.hash) {
				result.push({
					lineNumber: lineNumber++,
					content: '',
					hash: currentBlock.hash,
					author: currentBlock.author ?? 'Unknown',
					authorMail: currentBlock.authorMail ?? '',
					authorTime: currentBlock.authorTime ?? 0,
					summary: currentBlock.summary ?? '',
				});
			}
			currentBlock = { hash };
		} else if (line.includes('\t')) {
			// Content line with tab separator
			const [info, content] = line.split('\t');
			if (info && currentBlock.hash) {
				result.push({
					lineNumber: lineNumber++,
					content: content ?? '',
					hash: currentBlock.hash,
					author: currentBlock.author ?? 'Unknown',
					authorMail: currentBlock.authorMail ?? '',
					authorTime: currentBlock.authorTime ?? 0,
					summary: currentBlock.summary ?? '',
				});
			}
		}
	}
	
	return result;
}

export function InlineBlame({ filePath, fileContent, onCommitClick }: InlineBlameProps) {
	const { activeRepo } = useAppStore();
	const [blameData, setBlameData] = useState<BlameLine[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [copiedHash, setCopiedHash] = useState<string | null>(null);

	// Fetch blame data
	useEffect(() => {
		if (!activeRepo || !filePath) return;

		setIsLoading(true);
		trpc.git.blame.query({
			repo: activeRepo,
			path: filePath,
		}).then((result: { error?: string | null; blame?: string | null }) => {
			if (result.error) {
				console.error('Blame error:', result.error);
				setBlameData([]);
			} else if (result.blame) {
				setBlameData(parseBlamePorcelain(result.blame));
			}
		}).finally(() => {
			setIsLoading(false);
		});
	}, [activeRepo, filePath]);

	const lines = useMemo(() => {
		return fileContent.split('\n').map((content, index) => ({
			lineNumber: index + 1,
			content,
			blame: blameData[index] ?? null,
		})) as Array<{ lineNumber: number; content: string; blame: BlameLine | null }>;
	}, [fileContent, blameData]);

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	};

	const handleCopyHash = (hash: string, e: React.MouseEvent) => {
		e.stopPropagation();
		navigator.clipboard.writeText(hash);
		setCopiedHash(hash);
		setTimeout(() => setCopiedHash(null), 2000);
	};

	if (isLoading) {
		return (
			<div className="text-xs text-muted-foreground p-4">
				Loading blame information...
			</div>
		);
	}

	return (
		<div className="font-mono text-sm">
			{lines.map((line) => (
				<div
					key={line.lineNumber}
					className="flex items-start group hover:bg-accent/30"
				>
					{/* Line number */}
					<div className="w-12 shrink-0 text-right pr-4 text-muted-foreground select-none">
						{line.lineNumber}
					</div>

					{/* Blame annotation */}
					{line.blame ? (
						(() => {
							const blame = line.blame;
							return (
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="w-48 shrink-0 pr-4 text-xs text-muted-foreground truncate cursor-pointer hover:text-foreground">
									<span className="font-medium">
										{blame.author}
									</span>
									<span className="ml-2 opacity-60">
										{formatDate(blame.authorTime)}
									</span>
								</div>
							</TooltipTrigger>
							<TooltipContent side="right" className="max-w-sm">
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<GitCommit className="h-4 w-4" />
										<code className="text-xs">
											{blame.hash.slice(0, 7)}
										</code>
										<Button
											variant="ghost"
											size="sm"
											className="h-5 w-5 p-0"
											onClick={(e) => handleCopyHash(blame.hash, e)}
										>
											{copiedHash === blame.hash ? (
												<Check className="h-3 w-3 text-green-600" />
											) : (
												<Copy className="h-3 w-3" />
											)}
										</Button>
									</div>
									<p className="text-sm font-medium truncate">
										{blame.summary}
									</p>
									<div className="flex items-center gap-4 text-xs text-muted-foreground">
										<div className="flex items-center gap-1">
											<User className="h-3 w-3" />
											{blame.author}
										</div>
										<div className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											{new Date(blame.authorTime * 1000).toLocaleDateString()}
										</div>
									</div>
									{onCommitClick && (
										<Button
											variant="outline"
											size="sm"
											className="w-full mt-2"
											onClick={() => onCommitClick(blame.hash)}
										>
											View Commit
										</Button>
									)}
								</div>
							</TooltipContent>
						</Tooltip>
							);
						})()
					) : (
						<div className="w-48 shrink-0 pr-4" />
					)}

					{/* Line content */}
					<div className="flex-1 whitespace-pre">
						{line.content || ' '}
					</div>
				</div>
			))}
		</div>
	);
}

// Simple inline blame pill for single line
interface BlamePillProps {
	hash: string;
	author: string;
	date: number;
	summary: string;
	onClick?: () => void;
}

export function BlamePill({ hash, author, date, summary, onClick }: BlamePillProps) {
	const formatDate = (timestamp: number) => {
		const d = new Date(timestamp * 1000);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
		return d.toLocaleDateString();
	};

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50 text-xs hover:bg-muted transition-colors"
					onClick={onClick}
				>
					<span className="font-mono text-muted-foreground">
						{hash.slice(0, 7)}
					</span>
					<span className="text-muted-foreground">•</span>
					<span>{author}</span>
					<span className="text-muted-foreground">•</span>
					<span className="text-muted-foreground">
						{formatDate(date)}
					</span>
				</button>
			</TooltipTrigger>
			<TooltipContent>
				<p className="text-sm font-medium max-w-xs truncate">
					{summary}
				</p>
			</TooltipContent>
		</Tooltip>
	);
}

export default InlineBlame;
