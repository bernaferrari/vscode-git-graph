/**
 * Undo Panel (Reflog-based)
 */

import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

interface ReflogEntry {
	hash: string;
	ref: string;
	action: string;
	message: string;
	date: string;
}

interface UndoPanelProps {
	repo: string;
}

export function UndoPanel({ repo }: UndoPanelProps) {
	const utils = trpc.useUtils();
	const { data: reflog } = trpc.git.reflog.useQuery({ repo }, { enabled: !!repo });

	const undoMutation = trpc.git.reset.useMutation({
		onSuccess: () => {
			utils.git.commits.invalidate();
			utils.git.repoInfo.invalidate();
		},
	});

	const [entries, setEntries] = useState<ReflogEntry[]>([]);

	useEffect(() => {
		if (reflog?.entries) {
			setEntries(reflog.entries as ReflogEntry[]);
		}
	}, [reflog]);

	const handleUndo = (hash: string, mode: 'soft' | 'mixed' | 'hard') => {
		undoMutation.mutate({ repo, commitHash: hash, mode });
	};

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center justify-between">
					<span>Undo History (Reflog)</span>
					<Badge variant="secondary">{entries.length}</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-64">
					<div className="space-y-1">
						{entries.map((entry, index) => (
							<div
								key={`${entry.hash}-${index}`}
								className="flex items-center justify-between p-2 rounded hover:bg-accent text-sm"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-mono text-xs text-muted-foreground">
											{entry.hash.slice(0, 7)}
										</span>
										<Badge variant="outline" className="text-xs">
											{entry.action}
										</Badge>
									</div>
									<p className="truncate text-xs">{entry.message}</p>
									<p className="text-xs text-muted-foreground">{entry.date}</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 px-2"
									onClick={() => { handleUndo(entry.hash, 'hard'); }}
								>
									Undo
								</Button>
							</div>
						))}
						{entries.length === 0 && (
							<div className="text-center text-muted-foreground text-sm py-4">
								No undo history
							</div>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
