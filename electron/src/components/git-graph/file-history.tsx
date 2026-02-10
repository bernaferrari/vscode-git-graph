/**
 * File History View
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FileHistoryProps {
	repo: string;
	filePath: string;
	onSelectCommit?: (hash: string) => void;
}

interface HistoryEntry {
	hash: string;
	author: string;
	date: string;
	message: string;
	additions: number;
	deletions: number;
}

export function FileHistory({ repo, filePath, onSelectCommit }: FileHistoryProps) {
	const { data, isLoading, error } = trpc.git.fileHistory.useQuery(
		{ repo, path: filePath },
		{ enabled: !!repo && !!filePath }
	);

	const [history, setHistory] = useState<HistoryEntry[]>([]);

	useEffect(() => {
		if (data?.history) {
			setHistory(data.history as HistoryEntry[]);
		}
	}, [data]);

	if (isLoading) {
		return <div className="p-4 text-muted-foreground">Loading history...</div>;
	}

	if (error) {
		return <div className="p-4 text-destructive">Error loading history: {error.message}</div>;
	}

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center gap-2">
					<span>History: {filePath}</span>
					<Badge variant="secondary">{history.length} commits</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[400px]">
					<div className="space-y-1">
						{history.map((entry) => (
							<button
								key={entry.hash}
								onClick={() => onSelectCommit?.(entry.hash)}
								className="w-full text-left p-2 rounded hover:bg-accent text-sm"
							>
								<div className="flex items-center justify-between">
									<span className="font-mono text-xs text-muted-foreground">
										{entry.hash.slice(0, 7)}
									</span>
									<div className="flex items-center gap-2 text-xs">
										<span className="text-green-600">+{entry.additions}</span>
										<span className="text-red-600">-{entry.deletions}</span>
									</div>
								</div>
								<p className="truncate">{entry.message}</p>
								<p className="text-xs text-muted-foreground">
									{entry.author} • {entry.date}
								</p>
							</button>
						))}
						{history.length === 0 && (
							<div className="text-center text-muted-foreground py-4">
								No history found
							</div>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
