/**
 * Statistics View
 * Author breakdown, commit graphs, contribution calendar
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	BarChart3,
	Users,
	Calendar,
} from 'lucide-react';

interface StatisticsProps {
	open?: boolean;
	onClose?: () => void;
}

export function Statistics({ open = false, onClose }: StatisticsProps) {
	const { activeRepo } = useAppStore();
	const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');

	const { data: statsData } = trpc.git.statistics.useQuery(
		{
			repo: activeRepo ?? '',
			since: timeRange === 'all' ? undefined : `-${timeRange}`,
		},
		{ enabled: !!activeRepo && open }
	);

	const authors = statsData?.authors ?? [];
	const totalCommits = statsData?.totalCommits ?? 0;
	const maxCommits = Math.max(...authors.map((a) => a.commits), 1);

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
			<DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Repository Statistics
					</DialogTitle>
				</DialogHeader>
				
				<div className="flex items-center gap-1 pb-2">
					{(['7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
						<Button
							key={range}
							variant={timeRange === range ? 'secondary' : 'ghost'}
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={() => setTimeRange(range)}
						>
							{range === 'all' ? 'All Time' : range}
						</Button>
					))}
				</div>

				<Tabs defaultValue="authors" className="flex-1 flex flex-col overflow-hidden">
					<TabsList className="mx-4 mt-2">
						<TabsTrigger value="authors" className="text-xs">
							<Users className="h-3 w-3 mr-1" />
							Authors
						</TabsTrigger>
						<TabsTrigger value="activity" className="text-xs">
							<Calendar className="h-3 w-3 mr-1" />
							Activity
						</TabsTrigger>
					</TabsList>

					<TabsContent value="authors" className="flex-1 m-0 overflow-hidden">
						<ScrollArea className="h-full">
							<div className="p-4 space-y-6">
								<div className="grid grid-cols-3 gap-4">
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="text-2xl font-bold">{totalCommits}</div>
										<div className="text-xs text-muted-foreground">Total Commits</div>
									</div>
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="text-2xl font-bold">{authors.length}</div>
										<div className="text-xs text-muted-foreground">Contributors</div>
									</div>
									<div className="p-4 rounded-lg bg-muted/50">
										<div className="text-2xl font-bold">
											{totalCommits > 0 ? Math.round(totalCommits / authors.length) : 0}
										</div>
										<div className="text-xs text-muted-foreground">Avg per Author</div>
									</div>
								</div>

								<div>
									<h3 className="text-sm font-medium mb-3 flex items-center gap-2">
										<Users className="h-4 w-4" />
										Top Contributors
									</h3>
									<div className="space-y-2">
										{authors.slice(0, 20).map((author, index) => (
											<div key={author.email} className="flex items-center gap-3">
												<div className="w-6 text-xs text-muted-foreground text-right">
													#{index + 1}
												</div>
												<img
													src={`https://www.gravatar.com/avatar/${btoa(author.email).slice(0, 32)}?s=32&d=identicon`}
													alt={author.name}
													className="w-6 h-6 rounded-full"
												/>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="text-sm truncate">{author.name}</span>
														<span className="text-xs text-muted-foreground">
															{((author.commits / totalCommits) * 100).toFixed(1)}%
														</span>
													</div>
													<div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
														<div
															className="h-full bg-primary rounded-full transition-all"
															style={{ width: `${(author.commits / maxCommits) * 100}%` }}
														/>
													</div>
												</div>
												<div className="text-sm font-mono text-muted-foreground">
													{author.commits}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</ScrollArea>
					</TabsContent>

					<TabsContent value="activity" className="flex-1 m-0 overflow-hidden">
						<ScrollArea className="h-full">
							<div className="p-4">
								<h3 className="text-sm font-medium mb-3 flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									Commit Activity
								</h3>
								<p className="text-sm text-muted-foreground">
									Activity chart coming soon...
								</p>
							</div>
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
