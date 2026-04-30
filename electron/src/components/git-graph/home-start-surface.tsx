import { ArrowRight, CircleDotDashed, FolderOpen, ListTree } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    secondaryActionLabel?: string;
    secondaryActionBusyLabel?: string;
    isSecondaryActionBusy?: boolean;
    onSecondaryAction?: () => void;
    footerHint?: string;
    recentRepos: HomeStartRepoEntry[];
    openedRepos: HomeStartRepoEntry[];
    activeRepoPath?: string | null;
    onActivateRepo: (path: string) => void;
}

function getPathTail(path: string) {
    return path.split(/[\\/]/).pop() ?? path;
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
            className={`h-auto min-h-11 w-full justify-start rounded-lg border px-3 py-2 text-left ${
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
    secondaryActionLabel,
    secondaryActionBusyLabel,
    isSecondaryActionBusy = false,
    onSecondaryAction,
    footerHint,
    recentRepos,
    openedRepos,
    activeRepoPath,
    onActivateRepo,
}: HomeStartSurfaceProps) {
    const buttonLabel = isPrimaryActionBusy ? primaryActionBusyLabel ?? `${primaryActionLabel}…` : primaryActionLabel;
    const secondaryButtonLabel =
        isSecondaryActionBusy ? secondaryActionBusyLabel ?? `${secondaryActionLabel ?? ''}…` : secondaryActionLabel;
    const currentActiveRepoPath = activeRepoPath ?? null;
    const openedRepoEntries = openedRepos.filter((repo) => repo.path !== currentActiveRepoPath);
    const recentRepoEntries = recentRepos.filter(
        (repo) => repo.path !== currentActiveRepoPath && !openedRepoEntries.some((openedRepo) => openedRepo.path === repo.path)
    );
    const resumeRepos = [...openedRepoEntries, ...recentRepoEntries].slice(0, 4);

    if (mode === 'hero') {
        return (
            <section className='mx-auto w-full max-w-3xl'>
                <div className='rounded-lg border border-border/70 bg-card/80 p-7 shadow-[0_30px_90px_-65px_rgba(0,0,0,0.7)]'>
                    <Badge variant='outline' className='mb-4 border-border/70 text-muted-foreground'>
                        No repository selected
                    </Badge>
                    <h1 className='text-foreground text-3xl font-semibold leading-tight'>{title}</h1>
                    <p className='text-muted-foreground mt-2 max-w-xl text-sm leading-6'>{description}</p>

                    <div className='mt-6 flex flex-wrap items-center gap-2'>
                        <Button
                            size='lg'
                            className='min-w-40 gap-2'
                            onClick={onPrimaryAction}
                            disabled={isPrimaryActionBusy}
                            aria-label={primaryActionLabel}>
                            <FolderOpen className='h-4 w-4' />
                            {buttonLabel}
                        </Button>
                        {secondaryActionLabel && onSecondaryAction && (
                            <Button
                                size='lg'
                                variant='outline'
                                className='min-w-36'
                                onClick={onSecondaryAction}
                                disabled={isSecondaryActionBusy}
                                aria-label={secondaryActionLabel}>
                                {secondaryButtonLabel}
                            </Button>
                        )}
                    </div>

                    {resumeRepos.length > 0 && (
                        <div className='mt-7 border-t border-border/70 pt-5'>
                            <RepoSection
                                title='Recent'
                                repos={resumeRepos}
                                activeRepoPath={currentActiveRepoPath}
                                onActivateRepo={onActivateRepo}
                            />
                        </div>
                    )}
                </div>
            </section>
        );
    }

    return (
        <Card className='w-full'>
            <CardHeader className='px-3 pt-3'>
                <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary' className='border-border/70 bg-primary/10 text-primary'>
                        Start here
                    </Badge>
                    <Badge variant='outline' className='border-border/70 text-muted-foreground'>
                        Multi-repo
                    </Badge>
                </div>
                <CardTitle className='text-base'>{title}</CardTitle>
                <CardDescription className='text-xs'>{description}</CardDescription>
            </CardHeader>
            <CardContent className='px-3 pb-3'>
                <div className='space-y-4'>
                    <div className='space-y-4'>
                        <div className='flex flex-wrap gap-2'>
                            <Button
                                size='lg'
                                className='gap-2'
                                onClick={onPrimaryAction}
                                aria-label={primaryActionLabel}>
                                <FolderOpen className='h-4 w-4' />
                                {buttonLabel}
                            </Button>
                            {secondaryActionLabel && onSecondaryAction && (
                                <Button
                                    size='lg'
                                    variant='outline'
                                    className='gap-2'
                                    onClick={onSecondaryAction}
                                    disabled={isSecondaryActionBusy}
                                    aria-label={secondaryActionLabel}>
                                    {secondaryButtonLabel}
                                </Button>
                            )}
                        </div>
                        {footerHint && <p className='text-muted-foreground text-xs'>{footerHint}</p>}

                        <div className='space-y-3'>
                            <RepoSection
                                title='Opened repositories'
                                repos={openedRepoEntries}
                                activeRepoPath={currentActiveRepoPath}
                                onActivateRepo={onActivateRepo}
                                compact
                            />
                            <RepoSection
                                title='Recent repositories'
                                repos={recentRepoEntries}
                                activeRepoPath={currentActiveRepoPath}
                                onActivateRepo={onActivateRepo}
                                compact
                            />
                            {openedRepoEntries.length === 0 && recentRepoEntries.length === 0 && (
                                <div className='border-border/60 bg-muted/20 rounded-lg border border-dashed px-3 py-4 text-sm'>
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
                </div>
            </CardContent>
        </Card>
    );
}

export default HomeStartSurface;
