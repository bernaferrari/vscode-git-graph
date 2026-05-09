/**
 * Activity Heatmap
 * GitHub-style contribution calendar showing commit activity
 */

import { format, subDays, eachDayOfInterval, getDay } from 'date-fns';
import { Activity, Calendar, TrendingUp, ChevronLeft, ChevronRight, Users, GitCommit, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

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
    'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_40%,transparent)]',
    'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_50%,transparent)]',
    'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_60%,transparent)]',
    'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_70%,transparent)]',
    'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_80%,transparent)]',
];

export function ActivityHeatmap({ open, onOpenChange }: ActivityHeatmapProps) {
    const { activeRepo } = useAppStore();
    const [year, setYear] = useState(new Date().getFullYear());
    const { data: commitsResult, isLoading } = trpc.git.commits.useQuery(
        {
            repo: activeRepo ?? '',
            branches: null,
            maxCommits: 10000,
            order: 'date',
            onlyFollowFirstParent: false,
            showTags: false,
            showRemoteBranches: false,
            hideRemotes: [],
        },
        { enabled: Boolean(open && activeRepo) }
    );
    const commits = commitsResult?.commits ?? [];

    // Generate full year of days
    const yearDays = useMemo(() => {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        return eachDayOfInterval({ start, end });
    }, [year]);

    const activityData = useMemo(() => {
        const data = new Map<string, DayActivity>();

        for (const commit of commits) {
            const commitDate = new Date(commit.date * 1000);
            if (commitDate.getFullYear() !== year) continue;

            const key = format(commitDate, 'yyyy-MM-dd');
            const existing = data.get(key);

            if (existing) {
                existing.commits++;
                existing.authors.add(commit.author);
                continue;
            }

            data.set(key, {
                date: commitDate,
                commits: 1,
                additions: 0,
                deletions: 0,
                files: 0,
                authors: new Set([commit.author]),
            });
        }

        return data;
    }, [commits, year]);

    // Calculate statistics
    const stats = useMemo(() => {
        let totalCommits = 0;
        let activeDays = 0;
        let maxCommits = 0;
        const totalAuthors = new Set<string>();
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const sortedDays = Array.from(activityData.values()).sort((a, b) => b.date.getTime() - a.date.getTime());

        sortedDays.forEach((day) => {
            totalCommits += day.commits;
            if (day.commits > 0) {
                activeDays++;
                maxCommits = Math.max(maxCommits, day.commits);
                day.authors.forEach((a) => totalAuthors.add(a));
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
            <DialogContent className='ui-surface flex max-h-[90vh] max-w-4xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Activity className='h-5 w-5' />
                        Activity Heatmap
                        <div className='ml-auto flex items-center gap-2'>
                            <Button variant='ghost' size='sm' onClick={() => { setYear(year - 1); }}>
                                <ChevronLeft className='h-4 w-4' />
                            </Button>
                            <span className='w-16 text-center text-lg font-bold'>{year}</span>
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={() => { setYear(Math.min(year + 1, new Date().getFullYear())); }}
                                disabled={year >= new Date().getFullYear()}>
                                <ChevronRight className='h-4 w-4' />
                            </Button>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {/* Stats */}
                <div className='mb-4 grid grid-cols-4 gap-4'>
                    <div className='bg-muted/50 rounded-lg p-3 text-center'>
                        <GitCommit className='mx-auto mb-1 h-5 w-5 text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]' />
                        <p className='text-2xl font-bold'>{stats.totalCommits}</p>
                        <p className='text-muted-foreground text-xs'>Total Commits</p>
                    </div>
                    <div className='bg-muted/50 rounded-lg p-3 text-center'>
                        <Calendar className='mx-auto mb-1 h-5 w-5 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />
                        <p className='text-2xl font-bold'>{stats.activeDays}</p>
                        <p className='text-muted-foreground text-xs'>Active Days</p>
                    </div>
                    <div className='bg-muted/50 rounded-lg p-3 text-center'>
                        <TrendingUp className='mx-auto mb-1 h-5 w-5 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]' />
                        <p className='text-2xl font-bold'>{stats.longestStreak}</p>
                        <p className='text-muted-foreground text-xs'>Longest Streak</p>
                    </div>
                    <div className='bg-muted/50 rounded-lg p-3 text-center'>
                        <Users className='mx-auto mb-1 h-5 w-5 text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]' />
                        <p className='text-2xl font-bold'>{stats.totalAuthors}</p>
                        <p className='text-muted-foreground text-xs'>Contributors</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className='flex h-64 items-center justify-center'>
                        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
                    </div>
                ) : (
                    <ScrollArea className='flex-1'>
                        <div className='space-y-4'>
                            {/* Month labels */}
                            <div className='flex'>
                                <div className='w-8 shrink-0' />
                                <div className='flex flex-1'>
                                    {monthPositions.map(({ month, weekIndex }, i) => (
                                        <span
                                            key={i}
                                            className='text-muted-foreground text-xs'
                                            style={{
                                                position: 'relative',
                                                left: `${String((weekIndex / weeks.length) * 100)}%`,
                                                marginRight: (() => {
                                                    const next = monthPositions[i + 1];
                                                    if (!next) return undefined;
                                                    return `${String(((next.weekIndex - weekIndex) / weeks.length) * 100)}%`;
                                                })(),
                                            }}>
                                            {MONTHS[month]}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Heatmap grid */}
                            <div className='flex gap-2'>
                                {/* Day labels */}
                                <div className='flex w-8 shrink-0 flex-col gap-0.5'>
                                    {DAYS.map((day, i) => (
                                        <div
                                            key={day}
                                            className='text-muted-foreground flex h-3 items-center text-xs'
                                            style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* Grid */}
                                <div className='flex-1 overflow-x-auto'>
                                    <div className='flex gap-0.5' style={{ width: `${String(weeks.length * 14)}px` }}>
                                        {weeks.map((week, weekIndex) => (
                                            <div key={weekIndex} className='flex flex-col gap-0.5'>
                                                {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                                                    const day = week[dayIndex];
                                                    if (!day) return <div key={dayIndex} className='h-3 w-3' />;

                                                    const color = getHeatColor(day.commits) ?? '';

                                                    return (
                                                        <div
                                                            key={dayIndex}
                                                            className={`h-3 w-3 rounded-sm ${color}`}
                                                            title={`${format(day.date, 'MMM d, yyyy')} - ${String(day.commits)} ${
                                                                day.commits === 1 ? 'commit' : 'commits'
                                                            }${
                                                                day.authors.size > 0
                                                                    ? ` by ${String(day.authors.size)} ${
                                                                          day.authors.size === 1 ? 'author' : 'authors'
                                                                      }`
                                                                    : ''
                                                            }`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className='text-muted-foreground flex items-center justify-end gap-2 text-xs'>
                                <span>Less</span>
                                {HEAT_COLORS.map((color, i) => (
                                    <div key={i} className={`h-3 w-3 rounded-sm ${color}`} />
                                ))}
                                <span>More</span>
                            </div>
                        </div>
                    </ScrollArea>
                )}

                {/* Additional stats */}
                <div className='flex items-center justify-between border-t pt-4 text-sm'>
                    <div className='text-muted-foreground flex items-center gap-4'>
                        <span>Average: {stats.averagePerDay} commits/day</span>
                        <span>Max: {stats.maxCommits} commits</span>
                        {stats.currentStreak > 0 && (
                            <Badge variant='secondary' className='gap-1'>
                                <TrendingUp className='h-3 w-3' />
                                {stats.currentStreak} day streak
                            </Badge>
                        )}
                    </div>
                    <Button variant='ghost' onClick={() => { onOpenChange(false); }}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ActivityHeatmap;
