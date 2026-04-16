import { ArrowRight, CircleDotDashed, GitPullRequest, Layers3, ListTree, Sparkles } from 'lucide-react';


import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { ElementType } from 'react';

export interface HomeStartRepoEntry {
    path: string;
    name: string;
}

interface HomeStartSurfaceProps {
    mode: 'hero' | 'sidebar';
    title: string;
    description: string;
    primaryActionLabel: string;
    primaryActionBusyLabel?: string;
    isPrimaryActionBusy?: boolean;
    onPrimaryAction: () => void;
    recentRepos: HomeStartRepoEntry[];
    openedRepos: HomeStartRepoEntry[];
    activeRepoPath?: string | null;
    onActivateRepo: (path: string) => void;
}

interface ValueCardProps {
    icon: ElementType;
    title: string;
    description: string;
    badge: string;
}

function getPathTail(path: string) {
    return path.split(/[\\/]/).pop() ?? path;
}

function ValueCard({ icon: Icon, title, description, badge }: ValueCardProps) {
    return (
        <div className='bg-background/75 border-border/70 rounded-xl border p-3'>
            <div className='mb-2 flex items-center gap-2'>
                <Icon className='text-primary h-4 w-4' />
                <p className='text-sm font-semibold'>{title}</p>
            </div>
            <p className='text-muted-foreground text-xs'>{description}</p>
            <Badge variant='outline' className='mt-3 border-border/70 bg-background/80 text-muted-foreground'>
                {badge}
            </Badge>
        </div>
    );
}

function RepoButton({
    repo,
    onActivateRepo,
    activeRepoPath,
    compact,
}: {
    repo: HomeStartRepoEntry;
    onActivateRepo: (path: string) => void;
    activeRepoPath?: string | null;
    compact?: boolean;
}) {
    const active = activeRepoPath === repo.path;

    return (
        <Button
            variant='ghost'
            className={`h-auto w-full justify-start rounded-xl border px-3 py-2 text-left ${
                active ? 'border-primary/30 bg-primary/10' : 'border-border/60 hover:bg-accent/50'
            } ${compact ? 'gap-2' : 'gap-3'}`}
            onClick={() => {
                onActivateRepo(repo.path);
            }}
            aria-label={`Open ${repo.name}`}>
            <ListTree className='text-muted-foreground h-4 w-4 shrink-0' />
            <span className='min-w-0 flex-1 text-left'>
                <span className='block truncate text-sm font-medium'>{repo.name}</span>
                <span className='text-muted-foreground block truncate text-[11px]'>{getPathTail(repo.path)}</span>
            </span>
            {active && <Badge variant='secondary'>Active</Badge>}
            <ArrowRight className='text-muted-foreground h-4 w-4 shrink-0' />
        </Button>
    );
}

function RepoSection({
    title,
    repos,
    activeRepoPath,
    onActivateRepo,
    compact = false,
}: {
    title: string;
    repos: HomeStartRepoEntry[];
    activeRepoPath?: string | null;
    onActivateRepo: (path: string) => void;
    compact?: boolean;
}) {
    if (repos.length === 0) {
        return null;
    }

    const currentActiveRepoPath = activeRepoPath ?? null;

    return (
        <div className='space-y-2'>
            <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
                {title}
            </div>
            <div className='space-y-2'>
                {repos.slice(0, compact ? 3 : 5).map((repo) => (
                    <RepoButton
                        key={repo.path}
                        repo={repo}
                        onActivateRepo={onActivateRepo}
                        activeRepoPath={currentActiveRepoPath}
                        compact={compact}
                    />
                ))}
            </div>
        </div>
    );
}

export function HomeStartSurface({
    mode,
    title,
    description,
    primaryActionLabel,
    primaryActionBusyLabel,
    isPrimaryActionBusy = false,
    onPrimaryAction,
    recentRepos,
    openedRepos,
    activeRepoPath,
    onActivateRepo,
}: HomeStartSurfaceProps) {
    const buttonLabel = isPrimaryActionBusy ? primaryActionBusyLabel ?? `${primaryActionLabel}…` : primaryActionLabel;
    const currentActiveRepoPath = activeRepoPath ?? null;
    const openedRepoEntries = openedRepos.filter((repo) => repo.path !== currentActiveRepoPath);
    const recentRepoEntries = recentRepos.filter(
        (repo) => repo.path !== currentActiveRepoPath && !openedRepoEntries.some((openedRepo) => openedRepo.path === repo.path)
    );

    return (
        <Card className={mode === 'hero' ? 'w-full max-w-6xl shadow-[0_30px_80px_-50px_rgba(0,0,0,0.45)]' : 'w-full'}>
            <CardHeader className={mode === 'hero' ? 'px-5 pt-5' : 'px-3 pt-3'}>
                <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary' className='border-border/70 bg-primary/10 text-primary'>
                        Start here
                    </Badge>
                    <Badge variant='outline' className='border-border/70 text-muted-foreground'>
                        Multi-repo
                    </Badge>
                </div>
                <CardTitle className={mode === 'hero' ? 'text-2xl' : 'text-base'}>{title}</CardTitle>
                <CardDescription className={mode === 'hero' ? 'max-w-2xl text-sm' : 'text-xs'}>
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent className={mode === 'hero' ? 'px-5 pb-5' : 'px-3 pb-3'}>
                <div className={mode === 'hero' ? 'grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]' : 'space-y-4'}>
                    <div className='space-y-4'>
                        <div className='flex flex-wrap gap-2'>
                            <Button
                                size='lg'
                                className='gap-2'
                                onClick={onPrimaryAction}
                                aria-label={primaryActionLabel}>
                                <Sparkles className='h-4 w-4' />
                                {buttonLabel}
                            </Button>
                        </div>

                        <div className='space-y-3'>
                            <RepoSection
                                title='Opened repositories'
                                repos={openedRepoEntries}
                                activeRepoPath={currentActiveRepoPath}
                                onActivateRepo={onActivateRepo}
                                compact={mode === 'sidebar'}
                            />
                            <RepoSection
                                title='Recent repositories'
                                repos={recentRepoEntries}
                                activeRepoPath={currentActiveRepoPath}
                                onActivateRepo={onActivateRepo}
                                compact={mode === 'sidebar'}
                            />
                            {openedRepoEntries.length === 0 && recentRepoEntries.length === 0 && (
                                <div className='border-border/60 bg-muted/20 rounded-xl border border-dashed px-3 py-4 text-sm'>
                                    <div className='flex items-center gap-2 font-medium'>
                                        <CircleDotDashed className='text-muted-foreground h-4 w-4' />
                                        No repositories to resume yet
                                    </div>
                                    <p className='text-muted-foreground mt-1 text-xs'>
                                        Open a repository once, and it will appear here for faster multi-repo switching.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {mode === 'hero' && (
                        <div className='grid gap-3'>
                            <ValueCard
                                icon={Layers3}
                                title='Multi-repo focus'
                                description='Opened and recent repositories stay close at hand, so you can move between branches, clones, and workspaces without hunting through dialogs.'
                                badge='Resume faster'
                            />
                            <ValueCard
                                icon={GitPullRequest}
                                title='Review focus'
                                description='Pull requests, comments, merge actions, and collaboration stay visible once a repository is active.'
                                badge='Review ready'
                            />
                            <ValueCard
                                icon={CircleDotDashed}
                                title='Safer recovery'
                                description='History-changing actions are easier to understand when the shell gives you a clear place to resume work and inspect changes.'
                                badge='Less modal drift'
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default HomeStartSurface;
