/**
 * Activity Heatmap
 * GitHub-style contribution calendar showing commit activity
 */

import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	Activity,
	Calendar,
	TrendingUp,
	TrendingDown,
	Minus,
	ChevronLeft,
	ChevronRight,
	Users,
	GitCommit,
	BarChart3,
	Loader2,
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, getDay, getWeek, differenceInDays, isSameDay } from 'date-fns';

interface DayActivity {
	date: Date;
	commits: number;
	additions: number;
	deletions: number;
	files: number;
	authors: Set<string>;
}

interface ActivityHeatmapProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Color intensity levels
const HEAT_COLORS = [
	'bg-gray-100 dark:bg-gray-800',
	'bg-green-100 dark:bg-green-900/40',
	'bg-green-200 dark:bg-green-800/50',
	'bg-green-300 dark:bg-green-700/60',
	'bg-green-400 dark:bg-green-600/70',
	'bg-green-500 dark:bg-green-500/80',
];

export function ActivityHeatmap({
	open,
	onOpenChange,
}: ActivityHeatmapProps) {
	const { activeRepo } = useAppStore();
	const [year, setYear] = useState(new Date().getFullYear());
	const [isLoading, setIsLoading] = useState(false);
	const [activityData, setActivityData] = useState<Map<string, DayActivity>>(new Map());

	// Generate full year of days
	const yearDays = useMemo(() => {
		const start = new Date(year, 0, 1);
		const end = new Date(year, 11, 31);
		return eachDayOfInterval({ start, end });
	}, [year]);

	// Load commit activity
	useEffect(() => {
		if (!open || !activeRepo) return;

		const loadActivity = async () => {
			setIsLoading(true);
			try {
				// Get commits for the year
				const result = await trpc.git.commits.query({
					repo: activeRepo,
					maxCommits: 10000,
					order: 'date',
				});

				if (result?.commits) {
					const data = new Map<string, DayActivity>();

					result.commits.forEach((commit: { date: number; author: string; hash: string }) => {
						const commitDate = new Date(commit.date * 1000);
						if (commitDate.getFullYear() !== year) return;

						const key = format(commitDate, 'yyyy-MM-dd');
						const existing = data.get(key);

						if (existing) {
							existing.commits++;
							existing.authors.add(commit.author);
						} else {
							data.set(key, {
								date: commitDate,
								commits: 1,
								additions: 0,
								deletions: 0,
								files: 0,
								authors: new Set([commit.author]),
							});
						}
					});

					setActivityData(data);
				}
			} catch (error) {
				console.error('Failed to load activity:', error);
			} finally {
				setIsLoading(false);
			}
		};

		loadActivity();
	}, [open, activeRepo, year]);

	// Calculate statistics
	const stats = useMemo(() => {
		let totalCommits = 0;
		let activeDays = 0;
		let maxCommits = 0;
		let totalAuthors = new Set<string>();
		let currentStreak = 0;
		let longestStreak = 0;
		let tempStreak = 0;

		const sortedDays = Array.from(activityData.values()).sort((a, b) => b.date.getTime() - a.date.getTime());

		sortedDays.forEach((day) => {
			totalCommits += day.commits;
			if (day.commits > 0) {
				activeDays++;
				maxCommits = Math.max(maxCommits, day.commits);
				day.authors.forEach(a => totalAuthors.add(a));
			}
		});

		// Calculate streaks
		const today = new Date();
		for (let i = 0; i < 365; i++) {
			const date = subDays(today, i);
			const key = format(date, 'yyyy-MM-dd');
			const dayData = activityData.get(key);

			if (dayData && dayData.commits > 0) {
				tempStreak++;
				if (i === 0) currentStreak = tempStreak;
			} else if (i > 0) {
				longestStreak = Math.max(longestStreak, tempStreak);
				tempStreak = 0;
			}
		}
		longestStreak = Math.max(longestStreak, tempStreak);

		return {
			totalCommits,
			activeDays,
			maxCommits,
			totalAuthors: totalAuthors.size,
			currentStreak,
			longestStreak,
			averagePerDay: activeDays > 0 ? (totalCommits / activeDays).toFixed(1) : '0',
		};
	}, [activityData]);

	// Get color for activity level
	const getHeatColor = (commits: number) => {
		if (commits === 0) return HEAT_COLORS[0];
		if (commits <= 2) return HEAT_COLORS[1];
		if (commits <= 5) return HEAT_COLORS[2];
		if (commits <= 10) return HEAT_COLORS[3];
		if (commits <= 20) return HEAT_COLORS[4];
		return HEAT_COLORS[5];
	};

	// Group days by weeks
	const weeks = useMemo(() => {
		const weeksArray: DayActivity[][] = [];
		let currentWeek: DayActivity[] = [];

		yearDays.forEach((date) => {
			const dayOfWeek = getDay(date);
			
			// Start new week on Sunday
			if (dayOfWeek === 0 && currentWeek.length > 0) {
				weeksArray.push(currentWeek);
				currentWeek = [];
			}

			const key = format(date, 'yyyy-MM-dd');
			const activity = activityData.get(key) || {
				date,
				commits: 0,
				additions: 0,
				deletions: 0,
				files: 0,
				authors: new Set(),
			};

			currentWeek.push(activity);
		});

		if (currentWeek.length > 0) {
			weeksArray.push(currentWeek);
		}

		return weeksArray;
	}, [yearDays, activityData]);

	// Get months with their positions
	const monthPositions = useMemo(() => {
		const positions: { month: number; weekIndex: number }[] = [];
		
		weeks.forEach((week, weekIndex) => {
			const firstDay = week[0];
			if (firstDay && firstDay.date.getDate() <= 7) {
				positions.push({
					month: firstDay.date.getMonth(),
					weekIndex,
				});
			}
		});

		return positions;
	}, [weeks]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Activity className="h-5 w-5" />
						Activity Heatmap
						<div className="flex items-center gap-2 ml-auto">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setYear(year - 1)}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<span className="text-lg font-bold w-16 text-center">{year}</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setYear(Math.min(year + 1, new Date().getFullYear()))}
								disabled={year >= new Date().getFullYear()}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</DialogTitle>
				</DialogHeader>

				{/* Stats */}
				<div className="grid grid-cols-4 gap-4 mb-4">
					<div className="bg-muted/50 rounded-lg p-3 text-center">
						<GitCommit className="h-5 w-5 mx-auto mb-1 text-blue-500" />
						<p className="text-2xl font-bold">{stats.totalCommits}</p>
						<p className="text-xs text-muted-foreground">Total Commits</p>
					</div>
					<div className="bg-muted/50 rounded-lg p-3 text-center">
						<Calendar className="h-5 w-5 mx-auto mb-1 text-green-500" />
						<p className="text-2xl font-bold">{stats.activeDays}</p>
						<p className="text-xs text-muted-foreground">Active Days</p>
					</div>
					<div className="bg-muted/50 rounded-lg p-3 text-center">
						<TrendingUp className="h-5 w-5 mx-auto mb-1 text-orange-500" />
						<p className="text-2xl font-bold">{stats.longestStreak}</p>
						<p className="text-xs text-muted-foreground">Longest Streak</p>
					</div>
					<div className="bg-muted/50 rounded-lg p-3 text-center">
						<Users className="h-5 w-5 mx-auto mb-1 text-purple-500" />
						<p className="text-2xl font-bold">{stats.totalAuthors}</p>
						<p className="text-xs text-muted-foreground">Contributors</p>
					</div>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center h-64">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : (
					<ScrollArea className="flex-1">
						<div className="space-y-4">
							{/* Month labels */}
							<div className="flex">
								<div className="w-8 shrink-0" />
								<div className="flex-1 flex">
									{monthPositions.map(({ month, weekIndex }, i) => (
										<span
											key={i}
											className="text-xs text-muted-foreground"
											style={{
												position: 'relative',
												left: `${(weekIndex / weeks.length) * 100}%`,
												marginRight: i < monthPositions.length - 1
													? `${((monthPositions[i + 1].weekIndex - weekIndex) / weeks.length) * 100}%`
													: undefined,
											}}
										>
											{MONTHS[month]}
										</span>
									))}
								</div>
							</div>

							{/* Heatmap grid */}
							<div className="flex gap-2">
								{/* Day labels */}
								<div className="flex flex-col gap-0.5 w-8 shrink-0">
									{DAYS.map((day, i) => (
										<div
											key={day}
											className="h-3 text-xs text-muted-foreground flex items-center"
											style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
										>
											{day}
										</div>
									))}
								</div>

								{/* Grid */}
								<div className="flex-1 overflow-x-auto">
									<div className="flex gap-0.5" style={{ width: `${weeks.length * 14}px` }}>
										{weeks.map((week, weekIndex) => (
											<div key={weekIndex} className="flex flex-col gap-0.5">
												{[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
													const day = week[dayIndex];
													if (!day) return <div key={dayIndex} className="w-3 h-3" />;

													const color = getHeatColor(day.commits);

													return (
														<Tooltip key={dayIndex}>
															<TooltipTrigger asChild>
																<div
																	className={`w-3 h-3 rounded-sm ${color} cursor-pointer transition-transform hover:scale-125`}
																/>
															</TooltipTrigger>
															<TooltipContent side="top" className="text-xs">
																<div className="text-center">
																	<p className="font-medium">{format(day.date, 'MMM d, yyyy')}</p>
																	<p className="text-muted-foreground">
																		{day.commits} {day.commits === 1 ? 'commit' : 'commits'}
																	</p>
																	{day.authors.size > 0 && (
																		<p className="text-muted-foreground">
																			by {day.authors.size} {day.authors.size === 1 ? 'author' : 'authors'}
																		</p>
																	)}
																</div>
															</TooltipContent>
														</Tooltip>
													);
												})}
											</div>
										))}
									</div>
								</div>
							</div>

							{/* Legend */}
							<div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
								<span>Less</span>
								{HEAT_COLORS.map((color, i) => (
									<div
										key={i}
										className={`w-3 h-3 rounded-sm ${color}`}
									/>
								))}
								<span>More</span>
							</div>
						</div>
					</ScrollArea>
				)}

				{/* Additional stats */}
				<div className="flex items-center justify-between pt-4 border-t text-sm">
					<div className="flex items-center gap-4 text-muted-foreground">
						<span>Average: {stats.averagePerDay} commits/day</span>
						<span>Max: {stats.maxCommits} commits</span>
						{stats.currentStreak > 0 && (
							<Badge variant="secondary" className="gap-1">
								<TrendingUp className="h-3 w-3" />
								{stats.currentStreak} day streak
							</Badge>
						)}
					</div>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default ActivityHeatmap;
