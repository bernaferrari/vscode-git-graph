/**
 * File History View
 * Blame view and file history
 */

import {
	History,
	User,
	Calendar,
	Hash,
	Loader2,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface FileHistoryProps {
	filePath: string;
	onSelectCommit?: (hash: string) => void;
}

export function FileHistory({ filePath, onSelectCommit }: FileHistoryProps) {
	const { activeRepo } = useAppStore();
	const [view, setView] = useState<'blame' | 'history'>('blame');

	const { data: blameData, isLoading: blameLoading } = trpc.git.blame.useQuery(
		{
			repo: activeRepo ?? '',
			path: filePath,
		},
		{ enabled: !!activeRepo && !!filePath && view === 'blame' }
	);

	const { data: historyData, isLoading: historyLoading } = trpc.git.fileHistory.useQuery(
		{
			repo: activeRepo ?? '',
			path: filePath,
		},
		{ enabled: !!activeRepo && !!filePath && view === 'history' }
	);

	const parsedBlame = useMemo(() => {
		if (!blameData?.blame) return [];

		const lines: Array<{
			line: string;
			commit?: string;
			author?: string;
			date?: string;
			sourceLine?: number;
		}> = [];
		const blameText = String(blameData.blame);
		const blameLines = blameText.split('\n');

		let currentCommit: string | undefined;
		let currentAuthor: string | undefined;
		let currentDate: string | undefined;

		blameLines.forEach((line: string) => {
			if (line.startsWith('author ')) {
				currentAuthor = line.slice(7);
			} else if (line.startsWith('author-time ')) {
				const timestamp = parseInt(line.slice(12), 10);
				currentDate = new Date(timestamp * 1000).toLocaleDateString();
			} else if (/^[a-f0-9]{8} \d+ \d+/.test(line)) {
				const parts = line.split(' ');
				currentCommit = parts[0];
				} else if (line.startsWith('\t')) {
					lines.push({
						line: line.slice(1),
						...(currentCommit ? { commit: currentCommit } : {}),
						...(currentAuthor ? { author: currentAuthor } : {}),
						...(currentDate ? { date: currentDate } : {}),
					});
				}
			});

		return lines;
	}, [blameData?.blame]);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-4 py-2 border-b">
				<div className="flex items-center gap-2">
					<History className="h-4 w-4" />
					<span className="text-sm font-medium truncate max-w-[200px]">
						{filePath}
					</span>
				</div>
				<Tabs value={view} onValueChange={(v) => { setView(v as typeof view); }}>
					<TabsList className="h-7">
						<TabsTrigger value="blame" className="text-xs h-5 px-2">
							<User className="h-3 w-3 mr-1" />
							Blame
						</TabsTrigger>
						<TabsTrigger value="history" className="text-xs h-5 px-2">
							<History className="h-3 w-3 mr-1" />
							History
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<div className="flex-1 overflow-hidden">
				{view === 'blame' && (
					<>
						{blameLoading ? (
							<div className="flex items-center justify-center h-full">
								<Loader2 className="h-4 w-4 animate-spin" />
							</div>
						) : (
							<ScrollArea className="h-full">
								<div className="font-mono text-xs">
									{parsedBlame.map((item, i) => (
										<div
											key={i}
											className="flex hover:bg-accent/30 cursor-pointer"
											onClick={() => item.commit && onSelectCommit?.(item.commit)}
										>
											<div className="w-10 text-right pr-2 text-muted-foreground select-none border-r bg-muted/30">
												{i + 1}
											</div>
											<div className="w-20 px-1.5 py-0.5 truncate border-r bg-muted/10">
												<span className="text-[10px] font-normal">{item.commit?.slice(0, 8)}</span>
											</div>
											<div className="w-24 px-1.5 py-0.5 truncate border-r bg-muted/10">
												<span className="text-[10px] font-normal">{item.author}</span>
											</div>
											<div className="w-16 px-1.5 py-0.5 truncate border-r bg-muted/10">
												<span className="text-[10px] font-normal">{item.date}</span>
											</div>
											<pre className="px-2 py-0.5 whitespace-pre overflow-hidden flex-1">
												{item.line}
											</pre>
										</div>
									))}
								</div>
							</ScrollArea>
						)}
					</>
				)}

				{view === 'history' && (
					<>
						{historyLoading ? (
							<div className="flex items-center justify-center h-full">
								<Loader2 className="h-4 w-4 animate-spin" />
							</div>
						) : (
							<ScrollArea className="h-full">
								<div className="divide-y">
									{((historyData?.history ?? []) as Array<{ hash: string; message: string; author: string; date: string }>).map((commit) => (
										<div
											key={commit.hash}
											className="p-3 hover:bg-accent/30 cursor-pointer"
											onClick={() => onSelectCommit?.(commit.hash)}
										>
											<div className="flex items-center gap-2 mb-1">
												<Hash className="h-3 w-3 text-muted-foreground" />
												<span className="font-mono text-xs">{commit.hash.slice(0, 8)}</span>
												<span className="text-xs text-muted-foreground flex-1 truncate">
													{commit.message}
												</span>
											</div>
											<div className="flex items-center gap-3 text-[10px] text-muted-foreground">
												<span className="flex items-center gap-1">
													<User className="h-3 w-3" />
													{commit.author}
												</span>
												<span className="flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													{new Date(commit.date).toLocaleDateString()}
												</span>
											</div>
										</div>
									))}
								</div>
							</ScrollArea>
						)}
					</>
				)}
			</div>
		</div>
	);
}
