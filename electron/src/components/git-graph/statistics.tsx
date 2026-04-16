/**
 * Repository Insights
 * Author breakdown, activity cadence, and repository hotspots.
 */

import { Activity, BarChart3, Calendar, Flame, GitCommit, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getGravatarUrl } from '@/lib/gravatar';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface StatisticsProps {
	open?: boolean;
	onClose?: () => void;
}

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

interface AuthorStat {
	name: string;
	email: string;
	commits: number;
}

interface ActivityDay {
	date: string;
	commits: number;
}

interface HotspotFile {
	path: string;
	touches: number;
	additions: number;
	deletions: number;
}

interface SummaryStats {
	totalCommits?: number;
	activeDays?: number;
	avgCommitsPerActiveDay?: number;
	topAuthorSharePct?: number;
	velocityDeltaPct?: number;
	mergeCommits?: number;
	revertCommits?: number;
	totalAdditions?: number;
	totalDeletions?: number;
	busiestDay?: { date: string; commits: number };
}

function formatRange(range: TimeRange): string {
	return range === 'all' ? 'All Time' : range;
}

function formatDateLabel(date: string): string {
	return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Statistics({ open = false, onClose }: StatisticsProps) {
	const { activeRepo } = useAppStore();
	const [timeRange, setTimeRange] = useState<TimeRange>('30d');

	const queryInput = useMemo(
		() => ({
			repo: activeRepo ?? '',
			since: timeRange === 'all' ? undefined : `-${timeRange}`,
		}),
		[activeRepo, timeRange]
	);

	const { data: statsData } = trpc.git.statistics.useQuery(queryInput, { enabled: !!activeRepo && open });
	const { data: insightsData } = trpc.git.insights.useQuery(queryInput, { enabled: !!activeRepo && open });

	const authors: AuthorStat[] = statsData?.authors ?? [];
	const totalCommits = statsData?.totalCommits ?? 0;
	const maxCommits = Math.max(...authors.map((author: AuthorStat) => author.commits), 1);
	const activity: ActivityDay[] = insightsData?.activity ?? [];
	const maxDailyCommits = Math.max(...activity.map((day: ActivityDay) => day.commits), 1);
	const summary: SummaryStats | undefined = insightsData?.summary ?? undefined;
	const hotspots: HotspotFile[] = insightsData?.hotspots ?? [];

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose?.()}>
			<DialogContent className='ui-surface max-h-[84vh] max-w-4xl overflow-hidden p-0'>
				<DialogHeader className='border-border/70 border-b px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-base'>
						<BarChart3 className='h-5 w-5' />
						Repository Insights
					</DialogTitle>
				</DialogHeader>

				<div className='border-border/60 flex items-center gap-1 border-b px-5 py-3'>
					{(['7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
						<Button
							key={range}
							variant={timeRange === range ? 'secondary' : 'ghost'}
							size='sm'
							className='h-7 px-2 text-xs'
							onClick={() => { setTimeRange(range); }}>
							{formatRange(range)}
						</Button>
					))}
				</div>

				<Tabs defaultValue='insights' className='flex min-h-0 flex-1 flex-col overflow-hidden'>
					<TabsList className='mx-5 mt-4 w-fit'>
						<TabsTrigger value='insights' className='text-xs'>
							<Activity className='mr-1 h-3 w-3' />
							Insights
						</TabsTrigger>
						<TabsTrigger value='activity' className='text-xs'>
							<Calendar className='mr-1 h-3 w-3' />
							Activity
						</TabsTrigger>
						<TabsTrigger value='authors' className='text-xs'>
							<Users className='mr-1 h-3 w-3' />
							Authors
						</TabsTrigger>
					</TabsList>

					<TabsContent value='insights' className='m-0 min-h-0 flex-1 overflow-hidden'>
						<ScrollArea className='h-full'>
							<div className='grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4'>
								<InsightCard label='Total Commits' value={String(summary?.totalCommits ?? totalCommits)} hint='Selected range' icon={GitCommit} />
								<InsightCard
									label='Active Days'
									value={String(summary?.activeDays ?? 0)}
									hint={summary?.avgCommitsPerActiveDay ? `${summary.avgCommitsPerActiveDay} commits/day` : 'No activity'}
									icon={Calendar}
								/>
								<InsightCard
									label='Top Author Share'
									value={`${String(summary?.topAuthorSharePct ?? 0)}%`}
									hint='Contribution concentration'
									icon={Users}
								/>
								<InsightCard
									label='Velocity Trend'
									value={`${summary?.velocityDeltaPct && summary.velocityDeltaPct > 0 ? '+' : ''}${String(summary?.velocityDeltaPct ?? 0)}%`}
									hint='Current half vs previous half'
									icon={Activity}
								/>
							</div>
							<div className='grid gap-4 px-5 pb-5 md:grid-cols-[1.2fr_0.8fr]'>
								<section className='ui-surface rounded-xl border p-4'>
									<div className='mb-3 flex items-center gap-2'>
										<Flame className='h-4 w-4' />
										<h3 className='text-sm font-semibold'>Hotspots</h3>
									</div>
									<div className='space-y-2'>
										{hotspots.length === 0 && <p className='text-muted-foreground text-sm'>No hotspot data available.</p>}
										{hotspots.map((file: HotspotFile) => (
											<div key={file.path} className='rounded-lg border border-border/60 bg-background/70 p-3'>
												<div className='flex items-start justify-between gap-3'>
													<div className='min-w-0'>
														<p className='truncate text-sm font-medium'>{file.path}</p>
														<p className='text-muted-foreground text-xs'>
															{file.touches} touch{file.touches === 1 ? '' : 'es'} · +{file.additions} / -{file.deletions}
														</p>
													</div>
													<div className='text-muted-foreground text-xs'>{file.touches}x</div>
												</div>
											</div>
										))}
									</div>
								</section>
								<section className='ui-surface rounded-xl border p-4'>
									<div className='mb-3 flex items-center gap-2'>
										<BarChart3 className='h-4 w-4' />
										<h3 className='text-sm font-semibold'>Quality Signals</h3>
									</div>
									<div className='space-y-3 text-sm'>
										<SignalRow label='Merge Commits' value={String(summary?.mergeCommits ?? 0)} />
										<SignalRow label='Reverts / Rollbacks' value={String(summary?.revertCommits ?? 0)} />
										<SignalRow label='Lines Added' value={String(summary?.totalAdditions ?? 0)} />
										<SignalRow label='Lines Deleted' value={String(summary?.totalDeletions ?? 0)} />
										<SignalRow
											label='Busiest Day'
											value={
												summary?.busiestDay?.date
													? `${formatDateLabel(summary.busiestDay.date)} (${String(summary.busiestDay.commits)})`
													: 'N/A'
											}
										/>
									</div>
								</section>
							</div>
						</ScrollArea>
					</TabsContent>

					<TabsContent value='activity' className='m-0 min-h-0 flex-1 overflow-hidden'>
						<ScrollArea className='h-full'>
							<div className='space-y-5 p-5'>
								<section className='ui-surface rounded-xl border p-4'>
									<div className='mb-4 flex items-center gap-2'>
										<Calendar className='h-4 w-4' />
										<h3 className='text-sm font-semibold'>Commit Cadence</h3>
									</div>
									<div className='grid grid-cols-12 gap-2 md:grid-cols-16 xl:grid-cols-24'>
										{activity.length === 0 && <p className='text-muted-foreground col-span-full text-sm'>No activity for this range.</p>}
										{activity.map((day: ActivityDay) => (
											<div key={day.date} className='flex min-w-0 flex-col items-center gap-2'>
												<div className='flex h-28 w-full items-end rounded-md bg-muted/40 px-1 pb-1'>
													<div
														className='w-full rounded-sm bg-primary/80 transition-[height] motion-reduce:transition-none'
														style={{ height: `${Math.max(8, (day.commits / maxDailyCommits) * 100)}%` }}
														title={`${formatDateLabel(day.date)}: ${String(day.commits)} commits`}
													/>
												</div>
												<p className='text-muted-foreground w-full truncate text-center text-[10px]'>{formatDateLabel(day.date)}</p>
											</div>
										))}
									</div>
								</section>
							</div>
						</ScrollArea>
					</TabsContent>

					<TabsContent value='authors' className='m-0 min-h-0 flex-1 overflow-hidden'>
						<ScrollArea className='h-full'>
							<div className='space-y-5 p-5'>
								<section className='grid gap-4 md:grid-cols-3'>
									<InsightCard label='Total Commits' value={String(totalCommits)} hint='Selected range' icon={GitCommit} />
									<InsightCard label='Contributors' value={String(authors.length)} hint='Unique authors' icon={Users} />
									<InsightCard
										label='Average per Author'
										value={authors.length > 0 ? String(Math.round(totalCommits / authors.length)) : '0'}
										hint='Simple average'
										icon={BarChart3}
									/>
								</section>
								<section className='ui-surface rounded-xl border p-4'>
									<div className='mb-4 flex items-center gap-2'>
										<Users className='h-4 w-4' />
										<h3 className='text-sm font-semibold'>Top Contributors</h3>
									</div>
									<div className='space-y-2'>
										{authors.slice(0, 20).map((author: AuthorStat, index: number) => (
											<div key={author.email} className='flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2'>
												<div className='w-8 text-right text-xs text-muted-foreground'>#{index + 1}</div>
												<img
													src={getGravatarUrl(author.email, 32)}
													alt={author.name}
													className='h-8 w-8 rounded-full border border-border/60'
												/>
												<div className='min-w-0 flex-1'>
													<div className='flex items-center gap-2'>
														<span className='truncate text-sm font-medium'>{author.name}</span>
														<span className='text-muted-foreground text-xs'>
															{totalCommits > 0 ? `${((author.commits / totalCommits) * 100).toFixed(1)}%` : '0%'}
														</span>
													</div>
													<div className='mt-1 h-1.5 overflow-hidden rounded-full bg-muted'>
														<div
															className='h-full rounded-full bg-primary'
															style={{ width: `${(author.commits / maxCommits) * 100}%` }}
														/>
													</div>
												</div>
												<div className='text-muted-foreground font-mono text-sm'>{author.commits}</div>
											</div>
										))}
									</div>
								</section>
							</div>
						</ScrollArea>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}

function InsightCard({
	label,
	value,
	hint,
	icon: Icon,
}: {
	label: string;
	value: string;
	hint: string;
	icon: typeof Activity;
}) {
	return (
		<div className='ui-surface rounded-xl border p-4'>
			<div className='mb-3 flex items-center justify-between gap-3'>
				<p className='text-sm font-medium'>{label}</p>
				<Icon className='text-muted-foreground h-4 w-4' />
			</div>
			<p className='text-2xl font-semibold tracking-tight'>{value}</p>
			<p className='text-muted-foreground mt-1 text-xs'>{hint}</p>
		</div>
	);
}

function SignalRow({ label, value }: { label: string; value: string }) {
	return (
		<div className='flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2'>
			<span className='text-muted-foreground'>{label}</span>
			<span className='font-medium'>{value}</span>
		</div>
	);
}

export default Statistics;
