/**
 * Git Blame View
 */

import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/trpc/client';

interface BlameLine {
	lineNumber: number;
	content: string;
	hash: string;
	author: string;
	date: string;
	previousHash?: string;
}

interface BlameViewProps {
	repo: string;
	filePath: string;
	commitHash?: string;
}

export function BlameView({ repo, filePath, commitHash }: BlameViewProps) {
	const { data, isLoading, error } = trpc.git.blame.useQuery(
		{ repo, path: filePath, commitHash },
		{ enabled: !!repo && !!filePath }
	);

	const [blameLines, setBlameLines] = useState<BlameLine[]>([]);
	const [hoveredHash, setHoveredHash] = useState<string | null>(null);

	useEffect(() => {
		if (data?.blame) {
			// Parse blame output
			const lines: BlameLine[] = [];
			const blameData = data.blame;
			const lines_ = blameData.split('\n');
			
			let currentHash = '';
			let currentAuthor = '';
			let currentDate = '';
			
			for (const line of lines_) {
				if (line.startsWith('\t')) {
					lines.push({
						lineNumber: lines.length + 1,
						content: line.slice(1),
						hash: currentHash,
						author: currentAuthor,
						date: currentDate,
					});
				} else if (line.includes('author ')) {
					currentAuthor = line.replace('author ', '').trim();
				} else if (line.includes('author-time ')) {
					const time = parseInt(line.replace('author-time ', '').trim());
					currentDate = new Date(time * 1000).toLocaleDateString();
				} else if (line.match(/^[a-f0-9]{40}/)) {
					currentHash = line.split(' ')[0] ?? '';
				}
			}
			
			setBlameLines(lines);
		}
	}, [data]);

	if (isLoading) {
		return <div className="p-4 text-muted-foreground">Loading blame...</div>;
	}

	if (error) {
		return <div className="p-4 text-destructive">Error loading blame: {error.message}</div>;
	}

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center gap-2">
					<span>Blame: {filePath}</span>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[400px]">
					<table className="w-full text-xs font-mono">
						<tbody>
							{blameLines.map((line) => (
								<tr
									key={line.lineNumber}
									className={`border-b border-border/50 hover:bg-accent ${
										hoveredHash === line.hash ? 'bg-accent/50' : ''
									}`}
									onMouseEnter={() => { setHoveredHash(line.hash); }}
									onMouseLeave={() => { setHoveredHash(null); }}
								>
									<td className="p-1 text-muted-foreground w-12 text-right">
										{line.lineNumber}
									</td>
									<td className="p-1 border-l border-border w-48">
										<div className="flex items-center gap-1 truncate">
											<Badge variant="outline" className="text-[10px] font-mono">
												{line.hash.slice(0, 7)}
											</Badge>
											<span className="truncate text-[10px]">{line.author}</span>
										</div>
									</td>
									<td className="p-1 border-l border-border pl-2">
										{line.content}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
