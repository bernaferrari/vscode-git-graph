/**
 * Commit Details Panel
 * Shows detailed information about a selected commit
 */

import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';

interface CommitDetailsPanelProps {
	commitHash: string | null;
	onClose?: () => void;
}

export function CommitDetailsPanel({ commitHash, onClose }: CommitDetailsPanelProps) {
	const { activeRepo } = useAppStore();
	const [selectedFile, setSelectedFile] = useState<string | null>(null);

	// Get commit details
	const { data: commitDetails, isLoading } = trpc.git.commitDetails.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: commitHash ?? '',
		},
		{ enabled: !!commitHash && !!activeRepo }
	);

	if (!commitHash) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground p-4">
				<p className="text-sm">Select a commit to view details</p>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
			</div>
		);
	}

	if (!commitDetails?.details) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground p-4">
				<p className="text-sm">Failed to load commit details</p>
			</div>
		);
	}

	const { details } = commitDetails;

	return (
		<div className="flex flex-col h-full border-l bg-background">
			{/* Header */}
			<div className="flex items-center justify-between p-3 border-b">
				<span className="font-medium text-sm">Commit Details</span>
				{onClose && (
					<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
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
				)}
			</div>

			<ScrollArea className="flex-1">
				<div className="p-3 space-y-3">
					{/* Commit Hash */}
					<div>
						<span className="text-xs text-muted-foreground">SHA</span>
						<code className="block text-sm font-mono mt-1 p-2 bg-muted rounded">
							{details.hash}
						</code>
					</div>

					{/* Author Info */}
					<div className="grid grid-cols-2 gap-2">
						<div>
							<span className="text-xs text-muted-foreground">Author</span>
							<p className="text-sm mt-1">{details.author}</p>
							<p className="text-xs text-muted-foreground">{details.authorEmail}</p>
						</div>
						<div>
							<span className="text-xs text-muted-foreground">Date</span>
							<p className="text-sm mt-1">{formatDate(details.authorDate)}</p>
							<p className="text-xs text-muted-foreground">{formatRelative(details.authorDate)}</p>
						</div>
					</div>

					{/* Committer (if different) */}
					{details.committer !== details.author && (
						<>
							<Separator />
							<div className="grid grid-cols-2 gap-2">
								<div>
									<span className="text-xs text-muted-foreground">Committer</span>
									<p className="text-sm mt-1">{details.committer}</p>
									<p className="text-xs text-muted-foreground">{details.committerEmail}</p>
								</div>
								<div>
									<span className="text-xs text-muted-foreground">Commit Date</span>
									<p className="text-sm mt-1">{formatDate(details.committerDate)}</p>
								</div>
							</div>
						</>
					)}

					<Separator />

					{/* Message */}
					<div>
						<span className="text-xs text-muted-foreground">Message</span>
						<p className="text-sm mt-1 whitespace-pre-wrap">{details.body}</p>
					</div>

					{/* Signature */}
					{details.signature && (
						<>
							<Separator />
							<div>
								<span className="text-xs text-muted-foreground">Signature</span>
								<div className="flex items-center gap-2 mt-1">
									<Badge variant={details.signature.status === 'Good' ? 'default' : 'destructive'}>
										{details.signature.status}
									</Badge>
									<span className="text-sm">{details.signature.signer}</span>
								</div>
							</div>
						</>
					)}

					<Separator />

					{/* File Changes */}
					<div>
						<span className="text-xs text-muted-foreground">Changed Files</span>
						<div className="mt-2 space-y-1">
							{details.fileChanges.map((file, index) => (
								<button
									key={index}
									className={`w-full text-left p-2 rounded text-sm hover:bg-accent ${
										selectedFile === file.newFilePath ? 'bg-accent' : ''
									}`}
									onClick={() => setSelectedFile(file.newFilePath)}
								>
									<div className="flex items-center gap-2">
										<Badge
											variant="outline"
											className="text-[10px] w-5 h-5 p-0 flex items-center justify-center"
										>
											{file.type}
										</Badge>
										<span className="truncate flex-1">
											{file.newFilePath}
											{file.oldFilePath && file.oldFilePath !== file.newFilePath && (
												<span className="text-muted-foreground">
													{' '}
													← {file.oldFilePath}
												</span>
											)}
										</span>
									</div>
									{file.additions !== null && file.deletions !== null && (
										<div className="flex gap-2 mt-1 text-[10px]">
											<span className="text-green-600">+{file.additions}</span>
											<span className="text-red-600">-{file.deletions}</span>
										</div>
									)}
								</button>
							))}
						</div>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
}

function formatDate(timestamp: number): string {
	return new Date(timestamp * 1000).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

function formatRelative(timestamp: number): string {
	const now = Date.now();
	const date = timestamp * 1000;
	const diff = now - date;

	const minutes = Math.floor(diff / (1000 * 60));
	const hours = Math.floor(diff / (1000 * 60 * 60));
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} minutes ago`;
	if (hours < 24) return `${hours} hours ago`;
	if (days < 7) return `${days} days ago`;

	return formatDate(timestamp);
}
