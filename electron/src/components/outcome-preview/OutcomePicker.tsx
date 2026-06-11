/**
 * Outcome Picker
 *
 * The cards-not-verbs entry point.
 *
 * Two modes share the same component:
 *
 * - **Single-source mode** ({@link IntegrationStrategy}): "bring in this branch"
 *   from one ref into another. Three cards: merge / rebase / squash.
 *
 * - **Batch mode** ({@link BatchStrategy}): "do something with these N commits"
 *   when the user has shift-selected a set. Cards: cherry-pick / squash / drop.
 *
 * Both modes use the same visual language, the same primary-rail selection,
 * and route through {@link useOutcomePicker} so the apply path is identical.
 */

import { AlertTriangle, CheckCircle2, GripVertical, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type IntegrationStrategy = 'merge' | 'rebase' | 'squash';
export type BatchStrategy = 'cherry-pick' | 'squash-batch' | 'drop';
export type AnyStrategy = IntegrationStrategy | BatchStrategy;

export interface IntegrationOption {
    strategy: IntegrationStrategy;
    conflicts: number | null;
    conflictFiles?: string[] | undefined;
    willRewriteHistory: boolean;
    commitsAfter: number;
    filesChanged?: number | null | undefined;
    riskLevel?: 'low' | 'medium' | 'high' | null | undefined;
    riskReasons?: string[] | undefined;
    warnings?: string[] | undefined;
    recommended?: boolean | undefined;
}

export interface BatchOption {
    strategy: BatchStrategy;
    conflicts: number;
    willRewriteHistory: boolean;
    disabled?: boolean | undefined;
    disabledReason?: string | undefined;
    recommended?: boolean | undefined;
}

interface SingleProps {
    mode?: 'single';
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceRef: string;
    targetRef: string;
    options: IntegrationOption[];
    onApply: (strategy: IntegrationStrategy) => void;
    loading?: boolean;
    previewLoading?: boolean;
    previewError?: string | null;
}

interface BatchProps {
    mode: 'batch';
    open: boolean;
    onOpenChange: (open: boolean) => void;
    commits: { hash: string; message: string }[];
    targetRef: string;
    options: BatchOption[];
    onApply: (strategy: BatchStrategy, orderedCommits: { hash: string; message: string }[]) => void;
    loading?: boolean;
}

type OutcomePickerProps = SingleProps | BatchProps;

const SINGLE_COPY: Record<IntegrationStrategy, { title: string; tagline: string; explainer: string; commits: string }> =
    {
        merge: {
            title: 'Preserve the branch',
            tagline: 'You see exactly what happened',
            explainer:
                'Both histories stay intact. A merge commit ties them together so you can always trace where work came from.',
            commits: 'Adds 1 merge commit',
        },
        rebase: {
            title: 'Make a clean line',
            tagline: 'Looks like you wrote it on top',
            explainer:
                'Your commits are replayed on top of the target. The history reads as a single line, but commit hashes change.',
            commits: 'Replays your commits',
        },
        squash: {
            title: 'One tidy commit',
            tagline: 'A single change to review',
            explainer:
                'Everything you did becomes one commit. Best for tight pull requests where reviewers only want the final shape.',
            commits: 'Collapses to 1 commit',
        },
    };

const BATCH_COPY: Record<
    BatchStrategy,
    {
        title: string;
        tagline: string;
        explainer: (n: number) => string;
        commits: (n: number) => string;
    }
> = {
    'cherry-pick': {
        title: 'Bring these in',
        tagline: 'Copy onto current branch',
        explainer: (n) =>
            `Each of the ${String(n)} selected commits is replayed on top of the current branch. Hashes change but messages and authors are preserved.`,
        commits: (n) => `Adds ${String(n)} commit${n === 1 ? '' : 's'}`,
    },
    'squash-batch': {
        title: 'Squash into one',
        tagline: 'Combine selected into a single commit',
        explainer: (n) =>
            `The ${String(n)} selected commits collapse into one. Best when they form a single logical change. Requires the commits to be contiguous on the current branch.`,
        commits: () => 'Collapses to 1 commit',
    },
    drop: {
        title: 'Drop from history',
        tagline: 'Remove these commits entirely',
        explainer: (n) =>
            `History is rewritten to skip over the ${String(n)} selected commits. The changes those commits introduced are removed.`,
        commits: (n) => `Removes ${String(n)} commit${n === 1 ? '' : 's'}`,
    },
};

const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85';

export function OutcomePicker(props: OutcomePickerProps) {
    if (props.mode === 'batch') {
        return <BatchPicker {...props} />;
    }
    return <SinglePicker {...props} />;
}

function SinglePicker({
    open,
    onOpenChange,
    sourceRef,
    targetRef,
    options,
    onApply,
    loading,
    previewLoading,
    previewError,
}: SingleProps) {
    const recommendedStrategy = useMemo(
        () => options.find((o) => o.recommended)?.strategy ?? options[0]?.strategy ?? 'merge',
        [options]
    );
    const [selected, setSelected] = useState<IntegrationStrategy>(recommendedStrategy);

    useEffect(() => {
        if (open) setSelected(recommendedStrategy);
    }, [open, recommendedStrategy]);

    const orderedOptions = useMemo(() => {
        const order: IntegrationStrategy[] = ['merge', 'rebase', 'squash'];
        return order
            .map((strategy) => options.find((o) => o.strategy === strategy))
            .filter((o): o is IntegrationOption => Boolean(o));
    }, [options]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-4xl gap-0 overflow-hidden p-0'>
                <DialogHeader className='border-border/60 space-y-1 border-b px-5 py-4'>
                    <DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
                        <span className='bg-primary/12 ring-primary/20 grid h-7 w-7 place-items-center rounded-md ring-1'>
                            <Sparkles className='text-primary h-3.5 w-3.5' />
                        </span>
                        <span className='font-semibold'>Bring in changes</span>
                        <span className='text-muted-foreground/85 font-mono text-[0.8125rem]'>
                            {sourceRef} → {targetRef}
                        </span>
                    </DialogTitle>
                    <DialogDescription className='text-muted-foreground/85 text-[11px]'>
                        Pick the shape of history you want. You can always undo.
                    </DialogDescription>
                </DialogHeader>

                {previewLoading || previewError ? (
                    <div
                        className={cn(
                            'flex items-center gap-2 border-b border-border/60 px-5 py-2.5 text-[11px]',
                            previewError ? 'bg-destructive/5 text-destructive' : 'bg-muted/20 text-muted-foreground/85'
                        )}>
                        {previewError ? (
                            <AlertTriangle className='h-3.5 w-3.5 shrink-0' />
                        ) : (
                            <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin' />
                        )}
                        <span className='line-clamp-2'>
                            {previewError
                                ? `Preview unavailable: ${previewError}`
                                : 'Checking conflicts and changed files…'}
                        </span>
                    </div>
                ) : null}

                <div className='grid grid-cols-1 gap-3 p-5 md:grid-cols-3'>
                    {orderedOptions.map((option) => (
                        <OutcomeCard
                            key={option.strategy}
                            strategy={option.strategy}
                            copy={{
                                tagline: SINGLE_COPY[option.strategy].tagline,
                                title: SINGLE_COPY[option.strategy].title,
                                explainer: SINGLE_COPY[option.strategy].explainer,
                                result: SINGLE_COPY[option.strategy].commits,
                            }}
                            conflicts={option.conflicts}
                            conflictFiles={option.conflictFiles}
                            filesChanged={option.filesChanged}
                            riskLevel={option.riskLevel}
                            riskReasons={option.riskReasons}
                            warnings={option.warnings}
                            willRewriteHistory={option.willRewriteHistory}
                            recommended={option.recommended}
                            selected={selected === option.strategy}
                            glyph={<MiniGraph variant={option.strategy} />}
                            onSelect={() => {
                                setSelected(option.strategy);
                            }}
                        />
                    ))}
                </div>

                <PickerFooter
                    loading={loading ?? false}
                    applyDisabled={(loading ?? false) || (previewLoading ?? false)}
                    onCancel={() => {
                        onOpenChange(false);
                    }}
                    onApply={() => {
                        onApply(selected);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

function BatchPicker({ open, onOpenChange, commits, targetRef, options, onApply, loading }: BatchProps) {
    const orderedOptions = useMemo(() => {
        const order: BatchStrategy[] = ['cherry-pick', 'squash-batch', 'drop'];
        return order
            .map((strategy) => options.find((o) => o.strategy === strategy))
            .filter((o): o is BatchOption => Boolean(o));
    }, [options]);

    const recommendedStrategy = useMemo(
        () =>
            options.find((o) => o.recommended)?.strategy ??
            orderedOptions.find((o) => !o.disabled)?.strategy ??
            orderedOptions[0]?.strategy ??
            'cherry-pick',
        [options, orderedOptions]
    );
    const [selected, setSelected] = useState<BatchStrategy>(recommendedStrategy);
    const [orderedCommits, setOrderedCommits] = useState(commits);

    useEffect(() => {
        if (open) {
            setSelected(recommendedStrategy);
            setOrderedCommits(commits);
        }
    }, [open, recommendedStrategy, commits]);

    const handleReorder = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0) return;
        setOrderedCommits((prev) => {
            if (from >= prev.length || to >= prev.length) return prev;
            const next = prev.slice();
            const [moved] = next.splice(from, 1);
            if (!moved) return prev;
            next.splice(to, 0, moved);
            return next;
        });
    };

    const selectedOption = orderedOptions.find((o) => o.strategy === selected);
    const applyDisabled = (loading ?? false) || (selectedOption?.disabled ?? false);

    const count = orderedCommits.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='max-w-4xl gap-0 overflow-hidden p-0'>
                <DialogHeader className='border-border/60 space-y-1 border-b px-5 py-4'>
                    <DialogTitle className='flex flex-wrap items-center gap-2 text-[0.9375rem]'>
                        <span className='bg-primary/12 ring-primary/20 grid h-7 w-7 place-items-center rounded-md ring-1'>
                            <Sparkles className='text-primary h-3.5 w-3.5' />
                        </span>
                        <span className='font-semibold'>
                            {count} commit{count === 1 ? '' : 's'} selected
                        </span>
                        <span className='text-muted-foreground/85 font-mono text-[0.8125rem]'>→ {targetRef}</span>
                    </DialogTitle>
                    <DialogDescription className='text-muted-foreground/85 text-[11px]'>
                        Pick what to do with this set. You can always undo.
                    </DialogDescription>
                </DialogHeader>

                <CommitChips
                    commits={orderedCommits}
                    onReorder={handleReorder}
                    orderMatters={selected === 'cherry-pick'}
                />

                <div className='grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-3'>
                    {orderedOptions.map((option) => (
                        <OutcomeCard
                            key={option.strategy}
                            strategy={option.strategy}
                            copy={{
                                tagline: BATCH_COPY[option.strategy].tagline,
                                title: BATCH_COPY[option.strategy].title,
                                explainer: BATCH_COPY[option.strategy].explainer(count),
                                result: BATCH_COPY[option.strategy].commits(count),
                            }}
                            conflicts={option.conflicts}
                            willRewriteHistory={option.willRewriteHistory}
                            recommended={option.recommended}
                            disabled={option.disabled}
                            disabledReason={option.disabledReason}
                            selected={selected === option.strategy}
                            glyph={<BatchMiniGraph variant={option.strategy} count={count} />}
                            onSelect={() => {
                                if (option.disabled) return;
                                setSelected(option.strategy);
                            }}
                        />
                    ))}
                </div>

                <PickerFooter
                    loading={loading ?? false}
                    applyDisabled={applyDisabled}
                    applyLabel={selectedOption?.strategy === 'drop' ? 'Drop these' : 'Apply this'}
                    destructive={selectedOption?.strategy === 'drop'}
                    onCancel={() => {
                        onOpenChange(false);
                    }}
                    onApply={() => {
                        onApply(selected, orderedCommits);
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}

const REORDER_CAP = 12;

function CommitChips({
    commits,
    onReorder,
    orderMatters,
}: {
    commits: { hash: string; message: string }[];
    onReorder: (from: number, to: number) => void;
    orderMatters: boolean;
}) {
    const reorderable = commits.length > 1 && commits.length <= REORDER_CAP;
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    const visible = reorderable ? commits : commits.slice(0, 6);
    const overflow = reorderable ? 0 : Math.max(0, commits.length - visible.length);

    const handleDrop = (from: number, to: number) => {
        setDragIndex(null);
        setOverIndex(null);
        onReorder(from, to);
    };

    return (
        <div className='border-border/60 bg-muted/15 flex flex-wrap items-center gap-1.5 border-b px-5 py-2.5'>
            <span className={cn(SECTION_LABEL, 'mr-0.5')}>{reorderable ? 'Order' : 'Selected'}</span>
            {visible.map((c, i) => (
                <CommitChip
                    key={c.hash}
                    commit={c}
                    index={i}
                    total={visible.length}
                    reorderable={reorderable}
                    dragging={dragIndex === i}
                    insertingBefore={overIndex === i && dragIndex !== null && dragIndex !== i}
                    onDragStart={() => {
                        setDragIndex(i);
                    }}
                    onDragEnter={() => {
                        setOverIndex(i);
                    }}
                    onDragEnd={() => {
                        setDragIndex(null);
                        setOverIndex(null);
                    }}
                    onDrop={(from) => {
                        handleDrop(from, i);
                    }}
                    onMoveBy={(delta) => {
                        const next = i + delta;
                        if (next < 0 || next >= visible.length) return;
                        onReorder(i, next);
                    }}
                />
            ))}
            {overflow > 0 && (
                <span className='border-border/70 bg-card/60 text-muted-foreground/85 inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums'>
                    +{overflow}
                </span>
            )}
            {reorderable && (
                <span className='text-muted-foreground/70 ml-auto text-[10px]'>
                    {orderMatters ? 'Drag or use ← → to reorder · order matters' : 'Drag or use ← → to reorder'}
                </span>
            )}
        </div>
    );
}

interface CommitChipProps {
    commit: { hash: string; message: string };
    index: number;
    total: number;
    reorderable: boolean;
    dragging: boolean;
    insertingBefore: boolean;
    onDragStart: () => void;
    onDragEnter: () => void;
    onDragEnd: () => void;
    onDrop: (from: number) => void;
    onMoveBy: (delta: number) => void;
}

function CommitChip({
    commit,
    index,
    total,
    reorderable,
    dragging,
    insertingBefore,
    onDragStart,
    onDragEnter,
    onDragEnd,
    onDrop,
    onMoveBy,
}: CommitChipProps) {
    const subject = commit.message.split('\n')[0] ?? '';
    return (
        <>
            {insertingBefore && (
                <span
                    aria-hidden
                    className='bg-primary inline-block h-5 w-[2px] rounded-full shadow-[0_0_0_2px_color-mix(in_oklch,var(--primary)_20%,transparent)]'
                />
            )}
            <span
                draggable={reorderable}
                onDragStart={(e) => {
                    if (!reorderable) return;
                    e.dataTransfer.setData('text/plain', String(index));
                    e.dataTransfer.effectAllowed = 'move';
                    onDragStart();
                }}
                onDragEnter={() => {
                    if (!reorderable) return;
                    onDragEnter();
                }}
                onDragOver={(e) => {
                    if (!reorderable) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnd={onDragEnd}
                onDrop={(e) => {
                    if (!reorderable) return;
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData('text/plain'));
                    if (Number.isFinite(from) && from !== index) onDrop(from);
                }}
                onKeyDown={(e) => {
                    if (!reorderable) return;
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        onMoveBy(-1);
                    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        onMoveBy(1);
                    }
                }}
                tabIndex={reorderable ? 0 : -1}
                role={reorderable ? 'button' : undefined}
                aria-label={
                    reorderable
                        ? `Commit ${commit.hash.slice(0, 7)} — ${subject}. Position ${String(index + 1)} of ${String(total)}. Use arrow keys to reorder.`
                        : undefined
                }
                title={commit.message}
                className={cn(
                    'inline-flex max-w-[16rem] items-center gap-1 rounded-md border bg-card/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground/85 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45',
                    reorderable && 'cursor-grab active:cursor-grabbing',
                    dragging ? 'border-primary/40 opacity-40' : 'border-border/70 hover:border-border'
                )}>
                {reorderable && (
                    <>
                        <GripVertical className='text-muted-foreground/60 h-2.5 w-2.5 shrink-0' aria-hidden />
                        <span className='bg-primary/15 text-primary inline-grid h-3.5 min-w-3.5 place-items-center rounded-sm px-1 text-[9px] font-semibold'>
                            {index + 1}
                        </span>
                    </>
                )}
                <span>{commit.hash.slice(0, 7)}</span>
                <span className='text-muted-foreground/85 truncate font-sans text-[10px]'>{subject}</span>
            </span>
        </>
    );
}

function PickerFooter({
    loading,
    applyDisabled,
    applyLabel = 'Apply this',
    destructive,
    onCancel,
    onApply,
}: {
    loading: boolean;
    applyDisabled?: boolean;
    applyLabel?: string;
    destructive?: boolean;
    onCancel: () => void;
    onApply: () => void;
}) {
    return (
        <footer className='border-border/60 bg-muted/15 flex items-center justify-between gap-3 border-t px-5 py-3'>
            <p className='text-muted-foreground/85 flex items-center gap-1.5 text-[11px]'>
                <CheckCircle2 className='h-3.5 w-3.5 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />
                Every change can be undone from the Activity panel.
            </p>
            <div className='flex items-center gap-2'>
                <Button variant='outline' size='sm' onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    variant={destructive ? 'destructive' : 'default'}
                    size='sm'
                    onClick={onApply}
                    disabled={applyDisabled ?? loading}>
                    {loading ? (
                        <>
                            <Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                            Applying…
                        </>
                    ) : (
                        applyLabel
                    )}
                </Button>
            </div>
        </footer>
    );
}

interface OutcomeCardProps {
    strategy: AnyStrategy;
    copy: { tagline: string; title: string; explainer: string; result: string };
    conflicts: number | null;
    conflictFiles?: string[] | undefined;
    filesChanged?: number | null | undefined;
    riskLevel?: 'low' | 'medium' | 'high' | null | undefined;
    riskReasons?: string[] | undefined;
    warnings?: string[] | undefined;
    willRewriteHistory: boolean;
    recommended?: boolean | undefined;
    selected: boolean;
    disabled?: boolean | undefined;
    disabledReason?: string | undefined;
    glyph: React.ReactNode;
    onSelect: () => void;
}

function OutcomeCard({
    copy,
    conflicts,
    conflictFiles,
    filesChanged,
    riskLevel,
    riskReasons,
    warnings,
    willRewriteHistory,
    recommended,
    selected,
    disabled,
    disabledReason,
    glyph,
    onSelect,
}: OutcomeCardProps) {
    const hasConflictData = conflicts !== null;
    const hasConflicts = (conflicts ?? 0) > 0;
    const visibleConflictFiles = conflictFiles?.slice(0, 3) ?? [];
    const extraConflictCount = Math.max(0, (conflictFiles?.length ?? 0) - visibleConflictFiles.length);
    const riskTone =
        riskLevel === 'high'
            ? 'destructive'
            : riskLevel === 'medium'
              ? 'warning'
              : riskLevel === 'low'
                ? 'success'
                : 'muted';

    return (
        <button
            type='button'
            onClick={onSelect}
            aria-disabled={disabled}
            title={disabled ? disabledReason : undefined}
            className={cn(
                'group/card relative flex flex-col rounded-xl border bg-card/40 p-3.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45',
                disabled && 'cursor-not-allowed opacity-55',
                !disabled && selected
                    ? 'border-primary/60 bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] shadow-[var(--shadow-md)] ring-1 ring-primary/20'
                    : 'border-border/70',
                !disabled && !selected && 'hover:border-border hover:bg-card/70'
            )}>
            {!disabled && selected && (
                <span aria-hidden className='bg-primary absolute inset-y-3 left-0 w-[2px] rounded-r-full' />
            )}
            {recommended && !disabled && (
                <span className='bg-primary/12 text-primary ring-primary/20 absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase ring-1'>
                    <Sparkles className='h-2.5 w-2.5' />
                    Recommended
                </span>
            )}

            <div className='space-y-0.5'>
                <p className={SECTION_LABEL}>{copy.tagline}</p>
                <h3 className='text-[0.9375rem] leading-tight font-semibold'>{copy.title}</h3>
            </div>

            <div className='border-border/60 -mx-3.5 my-3 border-t' />

            {glyph}

            <p className='text-muted-foreground mt-3 text-[11px] leading-relaxed'>{copy.explainer}</p>

            <dl className='mt-3 space-y-1 text-[11px]'>
                <Detail label='Result' value={copy.result} />
                <Detail
                    label='Rewrites history'
                    value={willRewriteHistory ? 'Yes' : 'No'}
                    tone={willRewriteHistory ? 'warning' : 'muted'}
                />
                <Detail
                    label='Conflicts'
                    value={
                        hasConflictData
                            ? conflicts === 0
                                ? 'None detected'
                                : `${String(conflicts)} file${conflicts === 1 ? '' : 's'}`
                            : 'Checking…'
                    }
                    tone={!hasConflictData ? 'muted' : hasConflicts ? 'destructive' : 'success'}
                    icon={!hasConflictData ? Loader2 : hasConflicts ? AlertTriangle : CheckCircle2}
                />
                {typeof filesChanged === 'number' ? (
                    <Detail label='Files changed' value={String(filesChanged)} />
                ) : null}
                {riskLevel ? (
                    <Detail
                        label='Risk'
                        value={riskLevel}
                        tone={riskTone}
                        icon={riskLevel === 'low' ? CheckCircle2 : AlertTriangle}
                    />
                ) : null}
            </dl>

            {visibleConflictFiles.length > 0 && (
                <div className='border-destructive/25 bg-destructive/5 mt-2 space-y-1 rounded-md border px-2 py-1.5'>
                    <p className='text-destructive text-[10px] font-medium'>Conflicting files</p>
                    <div className='space-y-0.5'>
                        {visibleConflictFiles.map((file) => (
                            <p key={file} className='text-destructive/90 truncate font-mono text-[10px]' title={file}>
                                {file}
                            </p>
                        ))}
                        {extraConflictCount > 0 && (
                            <p className='text-destructive/80 text-[10px]'>+{String(extraConflictCount)} more</p>
                        )}
                    </div>
                </div>
            )}

            {riskReasons && riskReasons.length > 0 ? (
                <p className='text-muted-foreground/85 mt-2 line-clamp-2 text-[10px] leading-snug'>{riskReasons[0]}</p>
            ) : warnings && warnings.length > 0 ? (
                <p className='text-muted-foreground/85 mt-2 line-clamp-2 text-[10px] leading-snug'>{warnings[0]}</p>
            ) : null}

            {disabled && disabledReason && (
                <p className='border-border/60 bg-muted/40 text-muted-foreground/85 mt-2 rounded-md border px-2 py-1.5 text-[10px] leading-snug'>
                    {disabledReason}
                </p>
            )}
        </button>
    );
}

function Detail({
    label,
    value,
    tone = 'muted',
    icon: Icon,
}: {
    label: string;
    value: string;
    tone?: 'muted' | 'success' | 'warning' | 'destructive';
    icon?: React.ComponentType<{ className?: string }>;
}) {
    const valueClass =
        tone === 'success'
            ? 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'
            : tone === 'warning'
              ? 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'
              : tone === 'destructive'
                ? 'text-destructive'
                : 'text-foreground/85';
    return (
        <div className='flex items-center justify-between gap-2'>
            <dt className='text-muted-foreground/85'>{label}</dt>
            <dd className={cn('flex items-center gap-1 font-medium tabular-nums', valueClass)}>
                {Icon ? <Icon className='h-3 w-3' /> : null}
                <span>{value}</span>
            </dd>
        </div>
    );
}

/**
 * Tiny SVG glyph for single-source mode (merge / rebase / squash).
 */
function MiniGraph({ variant }: { variant: IntegrationStrategy }) {
    const lane1 = 'var(--chart-1)';
    const lane2 = 'var(--chart-3)';

    return (
        <div className='border-border/60 bg-muted/25 rounded-lg border p-2.5'>
            <svg viewBox='0 0 200 80' role='img' aria-hidden className='h-[80px] w-full'>
                {variant === 'merge' && (
                    <>
                        <path d='M20 40 L180 40' stroke={lane1} strokeWidth='1.5' fill='none' />
                        <path
                            d='M70 40 C90 40 90 14 110 14 L150 14 C170 14 170 40 180 40'
                            stroke={lane2}
                            strokeWidth='1.5'
                            fill='none'
                        />
                        <Dot cx={20} cy={40} fill={lane1} />
                        <Dot cx={70} cy={40} fill={lane1} />
                        <Dot cx={180} cy={40} fill={lane1} highlight />
                        <Dot cx={110} cy={14} fill={lane2} />
                        <Dot cx={150} cy={14} fill={lane2} />
                    </>
                )}
                {variant === 'rebase' && (
                    <>
                        <path d='M20 40 L180 40' stroke={lane1} strokeWidth='1.5' fill='none' />
                        <Dot cx={20} cy={40} fill={lane1} />
                        <Dot cx={60} cy={40} fill={lane1} />
                        <Dot cx={100} cy={40} fill={lane2} />
                        <Dot cx={140} cy={40} fill={lane2} />
                        <Dot cx={180} cy={40} fill={lane2} highlight />
                    </>
                )}
                {variant === 'squash' && (
                    <>
                        <path d='M20 40 L180 40' stroke={lane1} strokeWidth='1.5' fill='none' />
                        <Dot cx={20} cy={40} fill={lane1} />
                        <Dot cx={70} cy={40} fill={lane1} />
                        <Dot cx={120} cy={40} fill={lane1} />
                        <Dot cx={180} cy={40} fill={lane2} highlight large />
                    </>
                )}
            </svg>
        </div>
    );
}

/**
 * Glyph for batch mode. The number of selected commits drives how many dots
 * we draw (capped at 4 for legibility) so the picture matches the user's
 * actual selection size at a glance.
 */
function BatchMiniGraph({ variant, count }: { variant: BatchStrategy; count: number }) {
    const lane1 = 'var(--chart-1)';
    const lane2 = 'var(--chart-3)';
    const danger = 'var(--destructive)';
    const drawCount = Math.min(Math.max(count, 1), 4);

    const sourceXs = (() => {
        const xs: number[] = [];
        const left = 30;
        const step = 22;
        for (let i = 0; i < drawCount; i++) xs.push(left + i * step);
        return xs;
    })();

    return (
        <div className='border-border/60 bg-muted/25 rounded-lg border p-2.5'>
            <svg viewBox='0 0 200 80' role='img' aria-hidden className='h-[80px] w-full'>
                {/* Source row (top) */}
                <path d='M20 18 L180 18' stroke={lane2} strokeWidth='1.2' fill='none' opacity={0.7} />
                {sourceXs.map((x, i) => (
                    <Dot key={`src-${String(i)}`} cx={x} cy={18} fill={lane2} />
                ))}
                {/* Target lane (bottom) */}
                <path d='M20 60 L180 60' stroke={lane1} strokeWidth='1.5' fill='none' />
                <Dot cx={20} cy={60} fill={lane1} />
                <Dot cx={60} cy={60} fill={lane1} />

                {variant === 'cherry-pick' && (
                    <>
                        {/* Each source dot replays as a new dot on the target */}
                        {sourceXs.map((x, i) => {
                            const tx = 90 + i * 22;
                            return (
                                <g key={`cp-${String(i)}`}>
                                    <path
                                        d={`M${String(x)} 22 C${String(x)} 40 ${String(tx)} 40 ${String(tx)} 56`}
                                        stroke={lane2}
                                        strokeWidth='1'
                                        strokeDasharray='2 3'
                                        fill='none'
                                        opacity={0.55}
                                    />
                                    <Dot cx={tx} cy={60} fill={lane2} />
                                </g>
                            );
                        })}
                    </>
                )}
                {variant === 'squash-batch' && (
                    <>
                        {/* Source dots converge into one big target dot */}
                        {sourceXs.map((x, i) => (
                            <path
                                key={`sq-${String(i)}`}
                                d={`M${String(x)} 22 C${String(x)} 40 150 40 150 56`}
                                stroke={lane2}
                                strokeWidth='1'
                                strokeDasharray='2 3'
                                fill='none'
                                opacity={0.5}
                            />
                        ))}
                        <Dot cx={150} cy={60} fill={lane2} highlight large />
                    </>
                )}
                {variant === 'drop' && (
                    <>
                        {/* Source dots get a strikethrough */}
                        {sourceXs.map((x, i) => (
                            <g key={`dr-${String(i)}`}>
                                <line x1={x - 4} y1={14} x2={x + 4} y2={22} stroke={danger} strokeWidth='1.5' />
                                <line x1={x - 4} y1={22} x2={x + 4} y2={14} stroke={danger} strokeWidth='1.5' />
                            </g>
                        ))}
                        <Dot cx={120} cy={60} fill={lane1} highlight />
                    </>
                )}
            </svg>
        </div>
    );
}

function Dot({
    cx,
    cy,
    fill,
    highlight,
    large,
}: {
    cx: number;
    cy: number;
    fill: string;
    highlight?: boolean;
    large?: boolean;
}) {
    const r = large ? 5.5 : 4;
    return (
        <>
            {highlight && <circle cx={cx} cy={cy} r={r + 4} fill={fill} opacity={0.18} />}
            <circle cx={cx} cy={cy} r={r} fill={fill} stroke='var(--card)' strokeWidth='1.5' />
        </>
    );
}

export default OutcomePicker;
