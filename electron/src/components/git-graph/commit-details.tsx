/**
 * Commit Details Panel
 * Shows detailed information about a selected commit
 */

import {
    X,
    GitBranch,
    Tag,
    Copy,
    GitCommit,
    Calendar,
    MoreHorizontal,
    ArrowRight,
    FileText,
    Plus,
    Minus,
    RotateCcw,
    History,
    Wand2,
    AlertTriangle,
} from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { toast } from 'sonner';

import { CIStatusPanel } from './ci-status';
import { FileHistory } from './file-history';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getGravatarUrl } from '@/lib/gravatar';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

const LazySideBySideDiff = lazy(() => import('./side-by-side-diff').then((mod) => ({ default: mod.SideBySideDiff })));
const LazyImageDiff = lazy(() => import('./image-diff').then((mod) => ({ default: mod.ImageDiff })));

// Check if file is an image
const isImageFile = (path: string): boolean => {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
};

interface CommitDetailsPanelProps {
    commitHash: string | null;
    onClose?: () => void;
    onNavigateToCommit?: (hash: string) => void;
    onFilterByAuthor?: (email: string) => void;
    onCreateBranch?: (hash: string) => void;
    onCreateTag?: (hash: string) => void;
    onReset?: (hash: string, mode: 'soft' | 'mixed' | 'hard') => void;
    onFileHistoryNavigate?: (hash: string) => void;
}

export function CommitDetailsPanel({
    commitHash,
    onClose,
    onNavigateToCommit,
    onFilterByAuthor,
    onCreateBranch,
    onCreateTag,
    onReset,
    onFileHistoryNavigate,
}: CommitDetailsPanelProps) {
    const { activeRepo } = useAppStore();
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [showDiff, setShowDiff] = useState(false);
    const [showFileHistory, setShowFileHistory] = useState(false);
    const [historyFile, setHistoryFile] = useState<string | null>(null);
    const [aiExplanation, setAiExplanation] = useState<string | null>(null);
    const [aiRiskAreas, setAiRiskAreas] = useState<string[]>([]);
    const [aiReviewSummary, setAiReviewSummary] = useState<string | null>(null);
    const [aiReviewRisks, setAiReviewRisks] = useState<string[]>([]);
    const [aiReviewSuggestions, setAiReviewSuggestions] = useState<string[]>([]);
    const [aiReviewTests, setAiReviewTests] = useState<string[]>([]);

    const { data: commitDetails, isLoading } = trpc.git.commitDetails.useQuery(
        {
            repo: activeRepo ?? '',
            commitHash: commitHash ?? '',
        },
        { enabled: !!commitHash && !!activeRepo }
    );
    const configAllQuery = trpc.config.getAll.useQuery(undefined, { staleTime: 10_000 });
    const aiProdEnabled = Boolean(
        (configAllQuery.data?.ui as { featureFlags?: { aiProd?: boolean } } | undefined)?.featureFlags?.aiProd
    );
	const explainCommitMutation = trpc.ai.explainCommit.useMutation({
		onSuccess: (result: {
			explanation?: string | null;
			error?: string | null;
			riskAreas?: string[];
		}) => {
            if (!result.explanation) {
                toast.warning(result.error ?? 'No AI explanation available');
                return;
            }
            setAiExplanation(result.explanation);
            setAiRiskAreas(result.riskAreas ?? []);
            if (result.error) {
                toast.warning('AI explanation used fallback', { description: result.error });
            } else {
                toast.success('Commit explanation generated');
            }
        },
		onError: (error: unknown) => {
			toast.error(error instanceof Error ? error.message : 'Failed to explain commit');
		},
	});
	const reviewDiffMutation = trpc.ai.reviewDiff.useMutation({
		onSuccess: (result: {
			summary?: string | null;
			error?: string | null;
			risks?: string[];
			suggestions?: string[];
			tests?: string[];
		}) => {
            if (!result.summary) {
                toast.warning(result.error ?? 'No AI review available');
                return;
            }
            setAiReviewSummary(result.summary);
            setAiReviewRisks(result.risks ?? []);
            setAiReviewSuggestions(result.suggestions ?? []);
            setAiReviewTests(result.tests ?? []);
            if (result.error) {
                toast.warning('AI review used fallback', { description: result.error });
            } else {
                toast.success('AI review notes generated');
            }
        },
		onError: (error: unknown) => {
			toast.error(error instanceof Error ? error.message : 'Failed to review diff');
		},
	});

    // Get selected file info
    const selectedFileInfo = commitDetails?.details?.fileChanges.find(
        (f: FileChange) => f.newFilePath === selectedFile || f.oldFilePath === selectedFile
    );

    // Handle file click - show diff
    const handleFileClick = (filePath: string) => {
        if (isImageFile(filePath)) {
            void import('./image-diff');
        } else {
            void import('./side-by-side-diff');
        }
        setSelectedFile(filePath);
        setShowDiff(true);
    };

    // Handle view file history
    const handleViewHistory = (filePath: string) => {
        setHistoryFile(filePath);
        setShowFileHistory(true);
    };

    const handleCreateBranch = () => {
        if (commitHash) {
            onCreateBranch?.(commitHash);
        }
    };

    const handleCreateTag = () => {
        if (commitHash) {
            onCreateTag?.(commitHash);
        }
    };

    const handleResetCommit = () => {
        if (commitHash) {
            onReset?.(commitHash, 'mixed');
        }
    };

    const handleExplainCommit = () => {
        if (!commitHash || !commitDetails?.details) {
            return;
        }
        const details = commitDetails.details;
        const diffSummary = details.fileChanges
            .slice(0, 250)
            .map(
                (file: FileChange) =>
                    `${file.type}\t${file.newFilePath}\t+${String(file.additions ?? 0)}\t-${String(file.deletions ?? 0)}`
            )
            .join('\n');

        explainCommitMutation.mutate({
            commitHash: details.hash,
            subject: details.body.split('\n')[0] ?? details.hash,
            body: details.body,
            diff: `Files changed: ${String(details.fileChanges.length)}\n${diffSummary}`,
        });
    };

    const handleReviewDiff = () => {
        if (!commitHash || !commitDetails?.details) {
            return;
        }
        const details = commitDetails.details;
        const diffSummary = details.fileChanges
            .slice(0, 250)
            .map(
                (file: FileChange) =>
                    `${file.type}\t${file.newFilePath}\t+${String(file.additions ?? 0)}\t-${String(file.deletions ?? 0)}`
            )
            .join('\n');

        reviewDiffMutation.mutate({
            title: details.body.split('\n')[0] ?? details.hash,
            files: details.fileChanges.map((file: FileChange) => file.newFilePath),
            diff: `Files changed: ${String(details.fileChanges.length)}\n${diffSummary}`,
        });
    };

    if (!commitHash) {
        return (
            <div className='text-muted-foreground ui-surface flex h-full items-center justify-center p-4'>
                <div className='text-center'>
                    <GitCommit className='mx-auto mb-3 h-10 w-10 opacity-30' />
                    <p className='text-sm'>Select a commit to view details</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className='ui-surface flex h-full items-center justify-center'>
                <div className='border-primary h-6 w-6 animate-spin rounded-full border-b-2' />
            </div>
        );
    }

    if (!commitDetails?.details) {
        return (
            <div className='text-muted-foreground ui-surface flex h-full items-center justify-center p-4'>
                <p className='text-sm'>Failed to load commit details</p>
            </div>
        );
    }

    const { details } = commitDetails;
    const [subjectLine, ...messageRemainder] = details.body.split('\n');
    const commitSubject = subjectLine?.trim() || 'No commit message';
    const commitBody = messageRemainder.join('\n').trim();

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className='ui-surface flex h-full flex-col'>
            {/* Header */}
            <div className='ui-toolbar flex items-center justify-between px-3 py-2.5'>
                <div className='flex items-center gap-2'>
                    <GitCommit className='text-muted-foreground h-4 w-4' />
                    <span className='text-sm font-semibold tracking-tight'>Commit</span>
                    <code className='text-muted-foreground bg-muted/70 rounded px-1.5 py-0.5 font-mono text-[10px]'>
                        {details.hash.slice(0, 7)}
                    </code>
                </div>
                <div className='flex items-center gap-1'>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='hover:bg-accent h-6 w-6 rounded-md p-0'
                        onClick={() => { copyToClipboard(details.hash); }}
                        title='Copy full SHA'>
                        <Copy className='h-3 w-3' />
                    </Button>
                    {onClose && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='hover:bg-accent h-6 w-6 rounded-md p-0'
                            onClick={onClose}>
                            <X className='h-4 w-4' />
                        </Button>
                    )}
                </div>
            </div>

            <ScrollArea className='flex-1'>
                <div className='space-y-4 p-3'>
                    {/* Author & Date */}
                    <div className='space-y-2'>
                        <div
                            className={`border-border/70 bg-muted/25 flex items-start gap-2.5 rounded-lg border p-2.5 ${onFilterByAuthor ? 'group hover:bg-accent/45 cursor-pointer transition-colors' : ''}`}
                            onClick={() => onFilterByAuthor?.(details.authorEmail)}
                            title={onFilterByAuthor ? 'Click to filter by author' : undefined}>
                            <img
                                src={getGravatarUrl(details.authorEmail, 64)}
                                alt={details.author}
                                className='border-border/60 h-8 w-8 shrink-0 rounded-full border'
                            />
                            <div className='min-w-0 flex-1'>
                                <p
                                    className={`text-sm font-medium ${onFilterByAuthor ? 'group-hover:text-primary' : ''}`}>
                                    {details.author}
                                </p>
                                <p className='text-muted-foreground truncate text-xs'>{details.authorEmail}</p>
                                <div className='text-muted-foreground mt-1 flex items-center gap-2 text-[11px]'>
                                    <Calendar className='h-3 w-3' />
                                    <span>{formatDate(details.authorDate)}</span>
                                    <span className='text-border'>•</span>
                                    <span>{formatRelative(details.authorDate)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Message */}
                    <div className='border-border/70 bg-background/55 space-y-1 rounded-lg border p-2.5'>
                        <div className='mb-1 flex items-center justify-between gap-2'>
                            <p className='text-[14px] leading-snug font-semibold tracking-tight'>{commitSubject}</p>
                            {aiProdEnabled && (
                                <div className='flex shrink-0 items-center gap-1'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        className='h-7 text-xs'
                                        onClick={handleExplainCommit}
                                        disabled={explainCommitMutation.isPending}>
                                        {explainCommitMutation.isPending ? (
                                            <div className='border-primary mr-1 h-3 w-3 animate-spin rounded-full border-b-2' />
                                        ) : (
                                            <Wand2 className='mr-1 h-3.5 w-3.5' />
                                        )}
                                        Explain
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        className='h-7 text-xs'
                                        onClick={handleReviewDiff}
                                        disabled={reviewDiffMutation.isPending}>
                                        {reviewDiffMutation.isPending ? (
                                            <div className='border-primary mr-1 h-3 w-3 animate-spin rounded-full border-b-2' />
                                        ) : (
                                            <AlertTriangle className='mr-1 h-3.5 w-3.5' />
                                        )}
                                        Review
                                    </Button>
                                </div>
                            )}
                        </div>
                        {commitBody && (
                            <p className='text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap'>
                                {commitBody}
                            </p>
                        )}
                        {!commitBody && <p className='text-muted-foreground text-xs'>Single-line commit message</p>}
                        {aiProdEnabled && aiExplanation && (
                            <div className='mt-2 rounded-md border border-emerald-500/35 bg-emerald-500/10 p-2'>
                                <p className='text-xs font-semibold text-emerald-700 dark:text-emerald-300'>
                                    AI Explanation
                                </p>
                                <p className='mt-1 text-xs whitespace-pre-wrap text-emerald-900 dark:text-emerald-100'>
                                    {aiExplanation}
                                </p>
                                {aiRiskAreas.length > 0 && (
                                    <div className='mt-2'>
                                        <p className='mb-1 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300'>
                                            <AlertTriangle className='h-3.5 w-3.5' />
                                            Risk Areas
                                        </p>
                                        <div className='space-y-1'>
                                            {aiRiskAreas.map((risk) => (
                                                <p key={risk} className='text-xs text-amber-900 dark:text-amber-100'>
                                                    - {risk}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {aiProdEnabled && aiReviewSummary && (
                            <div className='mt-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-2'>
                                <p className='text-xs font-semibold text-amber-700 dark:text-amber-300'>
                                    AI Review Notes
                                </p>
                                <p className='mt-1 text-xs whitespace-pre-wrap text-amber-950 dark:text-amber-50'>
                                    {aiReviewSummary}
                                </p>
                                {aiReviewRisks.length > 0 && (
                                    <div className='mt-2'>
                                        <p className='text-xs font-semibold text-amber-700 dark:text-amber-300'>
                                            Risks
                                        </p>
                                        <div className='mt-1 space-y-1'>
                                            {aiReviewRisks.map((risk) => (
                                                <p key={risk} className='text-xs text-amber-950 dark:text-amber-50'>
                                                    - {risk}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {aiReviewSuggestions.length > 0 && (
                                    <div className='mt-2'>
                                        <p className='text-xs font-semibold text-amber-700 dark:text-amber-300'>
                                            Suggested Follow-ups
                                        </p>
                                        <div className='mt-1 space-y-1'>
                                            {aiReviewSuggestions.map((suggestion) => (
                                                <p key={suggestion} className='text-xs text-amber-950 dark:text-amber-50'>
                                                    - {suggestion}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {aiReviewTests.length > 0 && (
                                    <div className='mt-2'>
                                        <p className='text-xs font-semibold text-amber-700 dark:text-amber-300'>
                                            Test Focus
                                        </p>
                                        <div className='mt-1 space-y-1'>
                                            {aiReviewTests.map((testIdea) => (
                                                <p key={testIdea} className='text-xs text-amber-950 dark:text-amber-50'>
                                                    - {testIdea}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Parents */}
                    {details.parents && details.parents.length > 0 && (
                        <div className='space-y-1'>
                            <span className='text-muted-foreground text-xs font-medium'>Parents</span>
                            <div className='flex flex-wrap gap-1.5'>
                                {details.parents.map((parent: string, i: number) => (
                                    <button
                                        key={parent}
                                        className='bg-muted hover:bg-primary hover:text-primary-foreground inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 font-mono text-xs transition-colors'
                                        onClick={() => onNavigateToCommit?.(parent)}
                                        title={`Go to ${parent}`}>
                                        {i === 0 ? (
                                            <ArrowRight className='h-3.5 w-3.5' />
                                        ) : (
                                            <GitCommit className='h-3.5 w-3.5' />
                                        )}
                                        {parent.slice(0, 7)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Signature */}
                    {details.signature && (
                        <div
                            className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
                                isGoodSignature(details.signature.status)
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                            <span className='font-medium'>{formatSignatureStatus(details.signature.status)}</span>
                            <span className='opacity-70'>•</span>
                            <span>{details.signature.signer}</span>
                        </div>
                    )}

                    {/* CI/CD */}
                    <CIStatusPanel commitHash={details.hash} {...(activeRepo ? { repo: activeRepo } : {})} />

                    {/* File Changes */}
                    <div className='space-y-2'>
                        <div className='flex items-center justify-between'>
                            <span className='text-muted-foreground text-xs font-medium'>
                                Changed Files ({details.fileChanges.length})
                            </span>
                            <div className='flex items-center gap-2 text-xs'>
                                <span className='text-green-600 dark:text-green-400'>
                                    +
                                    {details.fileChanges.reduce(
                                        (acc: number, f: { additions: number | null }) => acc + (f.additions ?? 0),
                                        0
                                    )}
                                </span>
                                <span className='text-red-600 dark:text-red-400'>
                                    -
                                    {details.fileChanges.reduce(
                                        (acc: number, f: { deletions: number | null }) => acc + (f.deletions ?? 0),
                                        0
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className='border-border/65 bg-background/45 space-y-0.5 rounded-lg border p-1'>
                            {details.fileChanges.map((file: FileChange, index: number) => (
                                <div
                                    key={index}
                                    className={`group border-border/40 flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-all duration-150 ${
                                        selectedFile === file.newFilePath
                                            ? 'bg-accent border-primary/35 shadow-[inset_2px_0_0_0_hsl(var(--primary))]'
                                            : 'hover:bg-accent/45'
                                    }`}
                                    onClick={() => { handleFileClick(file.newFilePath); }}>
                                    {/* Change type icon */}
                                    <FileChangeIcon type={file.type} />
                                    <span
                                        className={`rounded px-1 py-0.5 text-[10px] font-semibold ${fileChangeBadgeClass(file.type)}`}>
                                        {file.type}
                                    </span>

                                    {/* File path with middle truncation */}
                                    <span className='min-w-0 flex-1 truncate' title={file.newFilePath}>
                                        {middleTruncate(file.newFilePath)}
                                    </span>

                                    {/* Additions/deletions */}
                                    {(file.additions !== null || file.deletions !== null) && (
                                        <div className='flex shrink-0 items-center gap-1 font-mono text-[10px] opacity-55 transition-opacity group-hover:opacity-100'>
                                            {file.additions !== null && file.additions > 0 && (
                                                <span className='text-green-600 dark:text-green-400'>
                                                    +{file.additions}
                                                </span>
                                            )}
                                            {file.deletions !== null && file.deletions > 0 && (
                                                <span className='text-red-600 dark:text-red-400'>
                                                    -{file.deletions}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* More actions */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            className={`hover:bg-accent inline-flex h-5 w-5 items-center justify-center rounded-sm transition-opacity ${
                                                selectedFile === file.newFilePath
                                                    ? 'opacity-100'
                                                    : 'opacity-0 group-hover:opacity-100'
                                            }`}
                                            onClick={(e) => { e.stopPropagation(); }}>
                                            <MoreHorizontal className='h-3 w-3' />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align='end' className='w-48'>
                                            <DropdownMenuItem onClick={() => { copyToClipboard(file.newFilePath); }}>
                                                <Copy className='mr-2 h-4 w-4' />
                                                Copy path
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => { handleViewHistory(file.newFilePath); }}>
                                                <History className='mr-2 h-4 w-4' />
                                                View History
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <FileText className='mr-2 h-4 w-4' />
                                                View file at this commit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem>
                                                <RotateCcw className='mr-2 h-4 w-4' />
                                                Reset file to this revision
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* Diff Viewer */}
            {showDiff && selectedFile && selectedFileInfo && (
                <div className='ui-surface absolute inset-0 z-10 flex flex-col'>
                    <div className='ui-toolbar flex items-center justify-between px-3 py-2'>
                        <div className='flex items-center gap-2'>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-6 w-6 p-0'
                                onClick={() => { setShowDiff(false); }}>
                                <X className='h-4 w-4' />
                            </Button>
                            <span className='max-w-[200px] truncate text-sm font-medium'>{selectedFile}</span>
                        </div>
                    </div>
                    <div className='flex-1 overflow-hidden'>
                        <Suspense
                            fallback={
                                <div className='flex h-full items-center justify-center'>
                                    <div className='border-primary h-6 w-6 animate-spin rounded-full border-b-2' />
                                </div>
                            }>
                            {isImageFile(selectedFile) ? (
                                <LazyImageDiff
                                    file={{
                                        path: selectedFile,
                                        status: selectedFileInfo.type,
                                        ...(selectedFileInfo.oldFilePath
                                            ? { oldPath: selectedFileInfo.oldFilePath }
                                            : {}),
                                    }}
                                    commitHash={commitHash ?? ''}
                                />
                            ) : (
                                <LazySideBySideDiff
                                    file={{
                                        path: selectedFile,
                                        status: selectedFileInfo.type,
                                        ...(selectedFileInfo.oldFilePath ? { from: selectedFileInfo.oldFilePath } : {}),
                                    }}
                                    commitHash={commitHash ?? ''}
                                />
                            )}
                        </Suspense>
                    </div>
                </div>
            )}

            {/* File History Viewer */}
            {showFileHistory && historyFile && (
                <div className='ui-surface absolute inset-0 z-10 flex flex-col'>
                    <div className='ui-toolbar flex items-center justify-between px-3 py-2'>
                        <div className='flex items-center gap-2'>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-6 w-6 p-0'
                                onClick={() => { setShowFileHistory(false); }}>
                                <X className='h-4 w-4' />
                            </Button>
                            <span className='max-w-[200px] truncate text-sm font-medium'>{historyFile}</span>
                        </div>
                    </div>
                    <div className='flex-1 overflow-hidden'>
                        <FileHistory
                            filePath={historyFile}
                            onSelectCommit={(hash) => {
                                onFileHistoryNavigate?.(hash);
                                setShowFileHistory(false);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Footer actions */}
            <div className='ui-toolbar flex items-center gap-1 border-t p-2'>
                <Button
                    variant='ghost'
                    size='sm'
                    className='hover:bg-accent hover:border-border/65 h-7 gap-1 rounded-md border border-transparent text-xs font-medium'
                    onClick={handleCreateBranch}>
                    <GitBranch className='h-3 w-3' />
                    Branch
                </Button>
                <Button
                    variant='ghost'
                    size='sm'
                    className='hover:bg-accent hover:border-border/65 h-7 gap-1 rounded-md border border-transparent text-xs font-medium'
                    onClick={handleCreateTag}>
                    <Tag className='h-3 w-3' />
                    Tag
                </Button>
                <Button
                    variant='ghost'
                    size='sm'
                    className='hover:bg-accent hover:border-border/65 h-7 gap-1 rounded-md border border-transparent text-xs font-medium'
                    onClick={handleResetCommit}>
                    <RotateCcw className='h-3 w-3' />
                    Reset
                </Button>
            </div>
        </div>
    );
}

interface FileChange {
    type: string;
    newFilePath: string;
    oldFilePath: string | null;
    additions: number | null;
    deletions: number | null;
}

function FileChangeIcon({ type }: { type: string }) {
    switch (type) {
        case 'A':
            return <Plus className='h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400' />;
        case 'D':
            return <Minus className='h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400' />;
        case 'R':
            return <ArrowRight className='h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400' />;
        default:
            return <FileText className='text-muted-foreground h-3.5 w-3.5 shrink-0' />;
    }
}

function fileChangeBadgeClass(type: string): string {
    switch (type) {
        case 'A':
            return 'bg-green-500/15 text-green-700 dark:text-green-400';
        case 'D':
            return 'bg-red-500/15 text-red-700 dark:text-red-400';
        case 'R':
            return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
        default:
            return 'bg-muted text-muted-foreground';
    }
}

function formatSignatureStatus(status: string): string {
    switch (status) {
        case 'G':
            return 'Verified';
        case 'U':
            return 'Good (Unknown trust)';
        case 'X':
            return 'Signature Expired';
        case 'Y':
            return 'Key Expired';
        case 'R':
            return 'Key Revoked';
        case 'E':
            return 'Cannot Check';
        case 'B':
            return 'Bad Signature';
        default:
            return status;
    }
}

function isGoodSignature(status: string): boolean {
    return status === 'G' || status === 'U';
}

function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatRelative(timestamp: number): string {
    const now = Date.now();
    const date = timestamp * 1000;
    const diff = now - date;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 7) return `${days} days ago`;

    return formatDate(timestamp);
}

// Middle truncate long file paths: "src/components/very/long/path/to/file.ts" -> "src/.../to/file.ts"
function middleTruncate(path: string, maxLength: number = 40): string {
    if (path.length <= maxLength) return path;

    // Keep the filename intact
    const lastSlash = path.lastIndexOf('/');
    const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
    const dirPath = lastSlash >= 0 ? path.slice(0, lastSlash) : '';

    if (filename.length >= maxLength - 5) {
        // Filename is already long, just truncate end
        return filename.slice(0, maxLength - 3) + '...';
    }

    // Calculate how much of the directory path we can keep
    const availableForDir = maxLength - filename.length - 5; // -5 for ".../"

    if (availableForDir < 5) {
        return '.../' + filename;
    }

    // Keep start of directory path
    return dirPath.slice(0, availableForDir) + '.../' + filename;
}
