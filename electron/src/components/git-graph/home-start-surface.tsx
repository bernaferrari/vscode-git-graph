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

const KEYCAP_PATTERN = /(\?|⌘[A-Z⇧⇪⌥⌃]?[A-Z]?|⌥[A-Z]?|⇧[A-Z]?|Ctrl[+-][A-Z]?|Esc|Enter|Tab)/g;

function renderFooterHint(hint: string) {
    const parts = hint.split(KEYCAP_PATTERN);
    return parts.map((part, i) => {
        if (KEYCAP_PATTERN.test(part)) {
            // Reset the regex state because /g is stateful across .test calls.
            KEYCAP_PATTERN.lastIndex = 0;
            return (
                <kbd
                    key={`k-${String(i)}`}
                    className='mx-0.5 inline-flex items-center justify-center rounded-md border border-border/70 bg-card/90 px-1.5 py-px font-mono text-[10px] font-semibold text-foreground/85 shadow-[inset_0_-1px_0_color-mix(in_oklch,var(--border)_60%,transparent)]'>
                    {part}
                </kbd>
            );
        }
        KEYCAP_PATTERN.lastIndex = 0;
        return <span key={`t-${String(i)}`}>{part}</span>;
    });
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
            className={`group/repo-row h-auto min-h-10 w-full justify-start rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                    ? 'border-primary/30 bg-primary/8 hover:bg-primary/12'
                    : 'border-border/60 hover:border-border hover:bg-muted/50'
            } ${compact ? 'gap-2.5' : 'gap-3'}`}
            onClick={() => {
                onActivateRepo(repo.path);
            }}
            aria-label={`Open ${repo.name}`}>
            <ListTree className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className='min-w-0 flex-1 text-left'>
                <span className='block truncate text-[0.8125rem] font-medium tracking-[-0.005em]'>{repo.name}</span>
                <span className='text-muted-foreground/85 block truncate text-[11px] font-normal'>{getPathTail(repo.path)}</span>
            </span>
            {active && <Badge variant='soft' className='font-mono'>Active</Badge>}
            <ArrowRight className='text-muted-foreground/60 h-3.5 w-3.5 shrink-0 transition-transform group-hover/repo-row:translate-x-0.5' />
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
        <div className='space-y-1.5'>
            <div className='text-muted-foreground/85 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.06em]'>
                {title}
            </div>
            <div className='space-y-1.5'>
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
            <section className='mx-auto w-full max-w-2xl'>
                <div className='relative overflow-hidden rounded-2xl border border-border/70 bg-card p-8 shadow-[var(--shadow-lg)]'>
                    <div
                        aria-hidden
                        className='pointer-events-none absolute inset-x-0 top-0 h-32 opacity-50 dark:opacity-30'
                        style={{
                            background:
                                'radial-gradient(60% 100% at 50% 0%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 70%)',
                        }}
                    />
                    <div className='relative'>
                        <Badge variant='soft' className='mb-4'>
                            No repository selected
                        </Badge>
                        <h1 className='text-foreground text-[1.875rem] font-semibold leading-[1.15] tracking-[-0.022em]'>
                            {title}
                        </h1>
                        <p className='text-muted-foreground mt-2 max-w-xl text-[0.9375rem] leading-relaxed'>
                            {description}
                        </p>

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
                            <div className='mt-7 border-t border-border/60 pt-5'>
                                <RepoSection
                                    title='Recent'
                                    repos={resumeRepos}
                                    activeRepoPath={currentActiveRepoPath}
                                    onActivateRepo={onActivateRepo}
                                />
                            </div>
                        )}

                        {footerHint && (
                            <p className='mt-6 text-[11px] leading-relaxed text-muted-foreground/85'>
                                {renderFooterHint(footerHint)}
                            </p>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <Card className='w-full' size='sm'>
            <CardHeader className='px-3 pt-3'>
                <div className='flex flex-wrap items-center gap-1.5'>
                    <Badge variant='soft' className='bg-primary/10 text-primary border-primary/20'>
                        Start here
                    </Badge>
                    <Badge variant='outline'>Multi-repo</Badge>
                </div>
                <CardTitle className='text-[0.9375rem]'>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
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
                        {footerHint && (
                            <p className='text-xs leading-relaxed text-muted-foreground/85'>
                                {renderFooterHint(footerHint)}
                            </p>
                        )}

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
                                <div className='border-border/60 bg-muted/30 rounded-lg border border-dashed px-3 py-4 text-[0.8125rem]'>
                                    <div className='flex items-center gap-2 font-medium tracking-[-0.005em]'>
                                        <CircleDotDashed className='text-muted-foreground h-3.5 w-3.5' />
                                        No repositories to resume yet
                                    </div>
                                    <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                                        Open a repository once and it will appear here for faster multi-repo switching.
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
