import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertTriangle, BarChart3, GitPullRequest, MessageSquare, UserRound } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import type { CollaborationReviewQueueItem } from '@/components/git-graph/collaboration-review-queue';
import type { CollaborationReviewDashboard } from '@/components/git-graph/collaboration-types';

function DashboardCard({ label, value, hint }: { label: string; value: string; hint: string }) {
	return (
		<div className='rounded-2xl border border-border/60 bg-background/85 p-3'>
			<p className='text-[11px] uppercase tracking-[0.18em] text-muted-foreground'>{label}</p>
			<p className='mt-2 text-2xl font-semibold tabular-nums'>{value}</p>
			<p className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</p>
		</div>
	);
}

function formatDashboardDate(date: string): string {
	return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatRepoLabel(repoKey: string): string {
	const [host, ...pathSegments] = repoKey.split('/');
	const tail = pathSegments.slice(-2).join('/');
	if (tail.length > 0 && host !== undefined) return `${tail} · ${host}`;
	return repoKey;
}

export function CollaborationReviewDashboardTab({
	dashboard,
	reviewQueue,
	loading,
}: {
	dashboard: CollaborationReviewDashboard | null;
	reviewQueue: CollaborationReviewQueueItem[];
	loading?: boolean;
}) {
	const reviewLookup = useMemo(
		() =>
			reviewQueue.reduce<Record<string, CollaborationReviewQueueItem>>((accumulator, item) => {
				accumulator[item.targetId] = item;
				return accumulator;
			}, {}),
		[reviewQueue]
	);
	const maxActivity = Math.max(
		1,
		...(dashboard?.activityByDay ?? []).map((entry) => Math.max(entry.comments, entry.assignments))
	);

	return (
		<TabsContent value='reporting' className='m-0 min-h-0 flex-1 overflow-hidden'>
			<ScrollArea className='h-full'>
				<div className='space-y-5 p-5'>
					<div className='grid gap-4 lg:grid-cols-3 xl:grid-cols-6'>
						<DashboardCard
							label='Review Targets'
							value={String(dashboard?.summary.totalReviewTargets ?? 0)}
							hint='Tracked pull requests with collaboration state'
						/>
						<DashboardCard
							label='Open Review Work'
							value={String(dashboard?.summary.openReviewTargets ?? 0)}
							hint='Targets that still need assignment or resolution'
						/>
						<DashboardCard
							label='Unassigned'
							value={String(dashboard?.summary.unassignedReviewTargets ?? 0)}
							hint='Targets with no active reviewer ownership'
						/>
						<DashboardCard
							label='Stale'
							value={String(dashboard?.summary.staleReviewTargets ?? 0)}
							hint='Targets without meaningful updates for two days'
						/>
						<DashboardCard
							label='Threads'
							value={String(dashboard?.summary.unresolvedThreads ?? 0)}
							hint='PR and file-level collaboration comments'
						/>
						<DashboardCard
							label='Line Threads'
							value={String(dashboard?.summary.lineThreadCount ?? 0)}
							hint='Diff-anchored conversations on concrete lines'
						/>
					</div>

					<div className='grid gap-5 xl:grid-cols-[1.05fr_0.95fr]'>
						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='flex items-center gap-2 text-sm'>
									<UserRound className='h-4 w-4' />
									Reviewer Load
								</CardTitle>
								<CardDescription>
									Active queue pressure by reviewer, including blocked work.
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-3'>
								{loading ? (
									<p className='text-sm text-muted-foreground'>Loading review dashboard…</p>
								) : (dashboard?.reviewerLoad.length ?? 0) === 0 ? (
									<p className='text-sm text-muted-foreground'>No assigned review work yet.</p>
								) : (
									dashboard?.reviewerLoad.map((entry) => {
										const load = entry.activeAssignments + entry.completedAssignments;
										const loadWidth = Math.max(12, Math.min(100, load * 18));
										return (
											<div key={entry.memberId} className='rounded-2xl border border-border/60 bg-background/85 p-3'>
												<div className='flex items-start justify-between gap-3'>
													<div className='min-w-0'>
														<p className='text-sm font-medium'>{entry.memberName}</p>
														<p className='mt-1 text-xs text-muted-foreground'>
															{entry.activeAssignments} active · {entry.completedAssignments} done · {entry.blockedAssignments} blocked
														</p>
													</div>
													{entry.lastUpdatedAt ? (
														<Badge variant='outline'>
															{formatDistanceToNow(entry.lastUpdatedAt, { addSuffix: true })}
														</Badge>
													) : null}
												</div>
												<div className='mt-3 h-2.5 rounded-full bg-muted/60'>
													<div
														className={cn(
															'h-full rounded-full bg-primary/85',
															entry.blockedAssignments > 0 && 'bg-amber-500/85'
														)}
														style={{ width: `${String(loadWidth)}%` }}
													/>
												</div>
											</div>
										);
									})
								)}
							</CardContent>
						</Card>

						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='flex items-center gap-2 text-sm'>
									<BarChart3 className='h-4 w-4' />
									Status Breakdown
								</CardTitle>
								<CardDescription>
									Current assignment states across the shared review system.
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-3'>
								{(dashboard?.statusBreakdown ?? []).map((entry) => {
									const total = Math.max(
										1,
										...(dashboard?.statusBreakdown ?? []).map((statusEntry) => statusEntry.count)
									);
									const width = entry.count === 0 ? 0 : Math.max(10, (entry.count / total) * 100);
									return (
										<div key={entry.status} className='space-y-2'>
											<div className='flex items-center justify-between gap-3 text-sm'>
												<span className='capitalize text-foreground/90'>{entry.status.replace('-', ' ')}</span>
												<span className='tabular-nums text-muted-foreground'>{entry.count}</span>
											</div>
											<div className='h-2.5 rounded-full bg-muted/60'>
												<div
													className={cn(
														'h-full rounded-full',
														entry.status === 'done' && 'bg-emerald-500/85',
														entry.status === 'blocked' && 'bg-amber-500/85',
														entry.status === 'in-progress' && 'bg-sky-500/85',
														entry.status === 'open' && 'bg-primary/85'
													)}
													style={{ width: `${String(width)}%` }}
												/>
											</div>
										</div>
									);
								})}
							</CardContent>
						</Card>
					</div>

					<div className='grid gap-5 xl:grid-cols-[1.1fr_0.9fr]'>
						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='flex items-center gap-2 text-sm'>
									<GitPullRequest className='h-4 w-4' />
									Review Coverage
								</CardTitle>
								<CardDescription>
									Per-pull-request visibility into comments, file threads, and reviewer ownership.
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-3'>
								{loading ? (
									<p className='text-sm text-muted-foreground'>Loading review coverage…</p>
								) : (dashboard?.reviewTargets.length ?? 0) === 0 ? (
									<p className='text-sm text-muted-foreground'>No shared pull request review targets yet.</p>
								) : (
									dashboard?.reviewTargets.slice(0, 12).map((target) => {
										const reviewItem = reviewLookup[target.rootTargetId];
										return (
											<div key={target.rootTargetId} className='rounded-2xl border border-border/60 bg-background/85 p-3'>
												<div className='flex items-start justify-between gap-3'>
													<div className='min-w-0'>
														<p className='truncate text-sm font-medium'>
															{reviewItem ? `#${String(reviewItem.number)} ${reviewItem.title}` : target.rootTargetId}
														</p>
														<p className='mt-1 text-xs text-muted-foreground'>
															{target.assignmentCount} assignment{target.assignmentCount === 1 ? '' : 's'} · {target.commentCount} comment{target.commentCount === 1 ? '' : 's'} · {target.fileThreadCount} file thread{target.fileThreadCount === 1 ? '' : 's'}
														</p>
													</div>
													<div className='flex flex-wrap items-center justify-end gap-2'>
														{target.unassigned && <Badge variant='secondary'>Unassigned</Badge>}
														{target.stale && (
															<Badge variant='outline' className='border-amber-500/35 text-amber-700 dark:text-amber-200'>
																Stale
															</Badge>
														)}
														{target.blockedAssignments > 0 && (
															<Badge variant='outline' className='border-amber-500/35 text-amber-700 dark:text-amber-200'>
																{target.blockedAssignments} blocked
															</Badge>
														)}
													</div>
												</div>
												<div className='mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground'>
													<span>{target.lineThreadCount} line threads</span>
													<span>·</span>
													<span>{target.openAssignments} open</span>
													<span>·</span>
													<span>{target.completedAssignments} done</span>
													<span>·</span>
													<span>{formatDistanceToNow(target.lastActivityAt, { addSuffix: true })}</span>
												</div>
											</div>
										);
									})
								)}
							</CardContent>
						</Card>

						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='flex items-center gap-2 text-sm'>
									<Activity className='h-4 w-4' />
									Review Activity
								</CardTitle>
								<CardDescription>
									Comment and assignment throughput across the last two weeks.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{loading ? (
									<p className='text-sm text-muted-foreground'>Loading activity…</p>
								) : (dashboard?.activityByDay.length ?? 0) === 0 ? (
									<p className='text-sm text-muted-foreground'>No review activity recorded yet.</p>
								) : (
									<div className='grid grid-cols-7 gap-3'>
										{dashboard?.activityByDay.map((entry) => (
											<div key={entry.date} className='space-y-2'>
												<div className='flex h-24 items-end gap-1 rounded-xl bg-muted/35 p-2'>
													<div
														className='w-1/2 rounded-sm bg-primary/85'
														style={{ height: `${String(Math.max(10, (entry.assignments / maxActivity) * 100))}%` }}
														title={`${String(entry.assignments)} assignments`}
													/>
													<div
														className='w-1/2 rounded-sm bg-sky-500/85'
														style={{ height: `${String(Math.max(10, (entry.comments / maxActivity) * 100))}%` }}
														title={`${String(entry.comments)} comments`}
													/>
												</div>
												<p className='text-center text-[10px] text-muted-foreground'>{formatDashboardDate(entry.date)}</p>
											</div>
										))}
									</div>
								)}
								<div className='mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground'>
									<div className='flex items-center gap-1.5'>
										<span className='inline-block h-2.5 w-2.5 rounded-full bg-primary/85' />
										Assignments
									</div>
									<div className='flex items-center gap-1.5'>
										<span className='inline-block h-2.5 w-2.5 rounded-full bg-sky-500/85' />
										Comments
									</div>
									<div className='flex items-center gap-1.5'>
										<AlertTriangle className='h-3.5 w-3.5' />
										Stale items are older than two days
									</div>
									<div className='flex items-center gap-1.5'>
										<MessageSquare className='h-3.5 w-3.5' />
										Line threads come from diff-anchored discussion
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					<Card className='border-border/70'>
						<CardHeader>
							<CardTitle className='flex items-center gap-2 text-sm'>
								<GitPullRequest className='h-4 w-4' />
								Portfolio View
							</CardTitle>
							<CardDescription>
								Cross-repository review load grouped by stable remote identity.
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-3'>
							{loading ? (
								<p className='text-sm text-muted-foreground'>Loading portfolio view…</p>
							) : (dashboard?.repositories.length ?? 0) === 0 ? (
								<p className='text-sm text-muted-foreground'>No repo-scoped review portfolio data yet.</p>
							) : (
								dashboard?.repositories.slice(0, 8).map((entry) => (
									<div key={entry.repoKey} className='rounded-2xl border border-border/60 bg-background/85 p-3'>
										<div className='flex items-start justify-between gap-3'>
											<div className='min-w-0'>
												<p className='truncate text-sm font-medium'>{formatRepoLabel(entry.repoKey)}</p>
												<p className='mt-1 text-xs text-muted-foreground'>
													{entry.reviewTargetCount} review target{entry.reviewTargetCount === 1 ? '' : 's'} · {entry.openReviewTargets} open · {entry.unassignedReviewTargets} unassigned
												</p>
											</div>
											<div className='flex flex-wrap items-center justify-end gap-2'>
												{entry.staleReviewTargets > 0 && (
													<Badge variant='outline' className='border-amber-500/35 text-amber-700 dark:text-amber-200'>
														{entry.staleReviewTargets} stale
													</Badge>
												)}
												<Badge variant='outline'>{entry.lineThreadCount} line threads</Badge>
											</div>
										</div>
										<p className='mt-3 text-xs text-muted-foreground'>
											Last activity {formatDistanceToNow(entry.lastActivityAt, { addSuffix: true })}
										</p>
									</div>
								))
							)}
						</CardContent>
					</Card>
				</div>
			</ScrollArea>
		</TabsContent>
	);
}

export default CollaborationReviewDashboardTab;
