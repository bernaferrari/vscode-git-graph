/**
 * Stacked Branches Panel
 * Visualize and manage branch stacks like GitButler/Graphite
 */

import {
	GitBranch,
	GitPullRequest,
	ArrowUp,
	ArrowDown,
	Plus,
	Trash2,
	RefreshCw,
	ExternalLink,
	Check,
	Clock,
	AlertCircle,
	Loader2,
	Link2Off,
	Download,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { useStackedBranches, getStackOrder, type StackedBranch } from '@/lib/stackedBranches';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';


type PullRequestProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure';

interface RepoRemote {
	name: string;
	url: string;
}

interface GraphiteSyncBranchResult {
	branch: string;
	pr?: {
		url?: string | null;
		number?: number | null;
		state?: string | null;
	};
	baseDrift?: boolean;
	needsAttention?: boolean;
	pushError?: string | null;
}

interface GraphiteSyncResult {
	success: boolean;
	error?: string | null;
	warnings: string[];
	branches: GraphiteSyncBranchResult[];
}

interface GraphiteStackItem {
	branch: string;
	parent: string | null;
	baseBranch?: string;
}

interface GraphiteImportResult {
	error?: string | null;
	stack?: Array<{ branch: string; parent?: string | null }>;
}

interface PullRequestResult {
	error?: string | null;
	pullRequest?: {
		webUrl: string;
		state: string;
		number: number;
	};
}

const STATUS_CONFIG: Record<StackedBranch['status'], { icon: React.ElementType; color: string; label: string }> = {
	draft: { icon: Clock, color: 'text-yellow-500', label: 'Draft' },
	ready: { icon: Check, color: 'text-green-500', label: 'Ready' },
	merged: { icon: GitPullRequest, color: 'text-purple-500', label: 'Merged' },
	stale: { icon: AlertCircle, color: 'text-gray-500', label: 'Stale' },
};

interface StackedBranchesPanelProps {
	children?: React.ReactNode;
	enableGraphiteInterop?: boolean;
}

export function StackedBranchesPanel({ children, enableGraphiteInterop = true }: StackedBranchesPanelProps) {
	const { activeRepo } = useAppStore();
	const { getStack, removeBranch, reorderBranch, addBranch, updateBranch } = useStackedBranches();
	const [creatingPrBranchId, setCreatingPrBranchId] = useState<string | null>(null);
	const { data: repoInfo, refetch: refetchRepoInfo } = trpc.git.repoInfo.useQuery(
		{
			repo: activeRepo ?? '',
			showRemoteBranches: false,
			showStashes: false,
			hideRemotes: [],
		},
		{
			enabled: !!activeRepo,
			staleTime: 10_000,
		}
	);
	const { data: remotesData, refetch: refetchRemotes } = trpc.git.remotes.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo, staleTime: 10_000 }
	);
	const stack = activeRepo ? getStack(activeRepo) : [];
	const sortedStack = getStackOrder(stack);
	const graphiteStatus = trpc.git.graphite.status.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && enableGraphiteInterop, staleTime: 20_000 }
	);
	const validateStackQuery = trpc.git.graphite.validateStack.useQuery(
		{
			repo: activeRepo ?? '',
			stack: sortedStack.map((entry) => ({
				branch: entry.name,
				parent: sortedStack.find((candidate) => candidate.id === entry.parentId)?.name ?? null,
				baseBranch: entry.baseBranch,
			})),
		},
		{ enabled: !!activeRepo && enableGraphiteInterop && sortedStack.length > 0, staleTime: 10_000 }
	);
	const restackMutation = trpc.git.graphite.restack.useMutation();
	const syncStackMutation = trpc.git.graphite.syncStack.useMutation();
	const exportStackMutation = trpc.git.graphite.exportStack.useMutation();
	const importStackQuery = trpc.git.graphite.importStack.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: false }
	);
	const createPullRequest = trpc.git.createPullRequest.useMutation();
	const branchNames = useMemo(
		() => ((repoInfo?.branches ?? []) as string[]).filter((name) => !name.startsWith('remotes/')),
		[repoInfo?.branches]
	);
	const currentBranch = repoInfo?.head ?? null;
	const defaultBaseBranch = useMemo(() => {
		const preferred = ['main', 'master', 'develop'].find((branch) => branchNames.includes(branch));
		return preferred ?? branchNames[0] ?? 'main';
	}, [branchNames]);
	const remotes: RepoRemote[] = remotesData?.remotes ?? [];
	const remoteUrl = remotes.find((remote: RepoRemote) => remote.name === 'origin')?.url ?? '';
	const provider = detectProvider(remoteUrl);
	const integrityWarnings = useMemo(() => {
		const warnings: string[] = [];
		const idSet = new Set(stack.map((entry) => entry.id));
		const nameSet = new Set<string>();
		for (const entry of stack) {
			if (entry.parentId && !idSet.has(entry.parentId)) {
				warnings.push(`${entry.name} has missing parent reference`);
			}
			if (nameSet.has(entry.name)) {
				warnings.push(`Duplicate branch in stack: ${entry.name}`);
			}
			nameSet.add(entry.name);
		}
		return warnings;
	}, [stack]);
	const graphiteCliAvailable = graphiteStatus.data?.available === true;
	const graphiteInteropEnabled = enableGraphiteInterop && graphiteCliAvailable;
	const graphiteFallbackLocalMode = enableGraphiteInterop && graphiteStatus.data?.available === false;
	const graphiteStatusError = graphiteStatus.data?.error ?? null;
	const backendValidationWarnings: string[] = enableGraphiteInterop ? validateStackQuery.data?.issues ?? [] : [];

	if (!activeRepo) {
		return null;
	}

	const isDescendant = (candidateParentId: string | null, branchId: string): boolean => {
		let cursor = candidateParentId;
		let guard = 0;
		while (cursor && guard < stack.length + 5) {
			if (cursor === branchId) {
				return true;
			}
			cursor = stack.find((entry) => entry.id === cursor)?.parentId ?? null;
			guard += 1;
		}
		return false;
	};

	const handleAddCurrentBranch = () => {
		if (!currentBranch || currentBranch === 'HEAD') {
			toast.error('No checked-out branch available to add');
			return;
		}

		if (stack.some((branch) => branch.name === currentBranch)) {
			toast.info(`${currentBranch} is already in the stack`);
			return;
		}

		const parent = sortedStack[sortedStack.length - 1] ?? null;
		addBranch(activeRepo, {
			name: currentBranch,
			baseBranch: parent?.name ?? defaultBaseBranch,
			parentId: parent?.id ?? null,
			commitHash: 'HEAD',
			status: 'draft',
		});
		toast.success(`Added ${currentBranch} to branch stack`);
	};

	const handleCreateStackedPr = async (branch: StackedBranch) => {
		if (!provider) {
			toast.error('No supported pull request provider found on origin remote');
			return;
		}

		const parentBranch = stack.find((candidate) => candidate.id === branch.parentId);
		const targetBranch = parentBranch?.name ?? branch.baseBranch;

		if (!targetBranch || targetBranch === branch.name) {
			toast.error('Stack branch base is invalid for pull request creation');
			return;
		}

		setCreatingPrBranchId(branch.id);
		try {
			const result = (await createPullRequest.mutateAsync({
				repo: activeRepo,
				provider,
				title: branch.name,
				body: `Stacked branch PR targeting ${targetBranch}.`,
				head: branch.name,
				base: targetBranch,
				draft: branch.status === 'draft',
			})) as PullRequestResult;

			if (result.error || !result.pullRequest) {
				toast.error('Failed to create pull request', {
					description: result.error ?? 'Unknown error',
				});
				return;
			}

			updateBranch(activeRepo, branch.id, {
				prUrl: result.pullRequest.webUrl,
				status: result.pullRequest.state === 'merged' ? 'merged' : 'ready',
				baseBranch: targetBranch,
			});
			toast.success(`Created PR #${result.pullRequest.number} for ${branch.name}`);
		} catch (error) {
			toast.error('Failed to create pull request', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		} finally {
			setCreatingPrBranchId(null);
		}
	};

	const handleSyncStack = async () => {
		if (!enableGraphiteInterop) {
			toast.info('Graphite interoperability is disabled by feature flag');
			return;
		}
		if (!graphiteCliAvailable) {
			toast.info('Graphite CLI unavailable, syncing in local stack mode');
		}
			const result = (await syncStackMutation.mutateAsync({
				repo: activeRepo,
				stack: sortedStack.map((entry): GraphiteStackItem => ({
					branch: entry.name,
					parent: sortedStack.find((candidate) => candidate.id === entry.parentId)?.name ?? null,
					baseBranch: entry.baseBranch,
				})),
				push: true,
				forceWithLease: true,
				refreshPullRequests: true,
			})) as GraphiteSyncResult;

		if (!result.success) {
			toast.error(result.error ?? 'Stack sync completed with issues');
		} else {
			toast.success('Stack synchronized');
		}

		if (result.warnings.length > 0) {
			toast.warning(result.warnings.join('\n'));
		}

			result.branches.forEach((entry: GraphiteSyncBranchResult) => {
			const local = stack.find((item) => item.name === entry.branch);
			if (!local) return;

				const nextBranchUpdate: Partial<StackedBranch> = {
					syncState: entry.pushError ? 'error' : entry.needsAttention ? 'warning' : 'ok',
					syncMessage: entry.pushError ?? (entry.baseDrift ? 'Base drift detected' : 'Synced'),
					status:
						entry.pr?.state === 'merged'
							? 'merged'
							: entry.needsAttention
								? 'stale'
								: local.status === 'draft'
									? 'draft'
									: 'ready',
				};
				const nextPrUrl = entry.pr?.url ?? local.prUrl;
				if (typeof nextPrUrl === 'string') {
					nextBranchUpdate.prUrl = nextPrUrl;
				}
				const nextPrNumber = entry.pr?.number ?? local.prNumber;
				if (typeof nextPrNumber === 'number') {
					nextBranchUpdate.prNumber = nextPrNumber;
				}
				const nextPrState = entry.pr?.state ?? local.prState;
				if (nextPrState) {
					nextBranchUpdate.prState = nextPrState as 'open' | 'closed' | 'merged';
				}
				if (entry.baseDrift !== undefined) {
					nextBranchUpdate.baseDrift = entry.baseDrift;
				}
				if (entry.needsAttention !== undefined) {
					nextBranchUpdate.needsAttention = entry.needsAttention;
				}
				updateBranch(activeRepo, local.id, nextBranchUpdate);
			});

		void refetchRepoInfo();
	};

	const requireGraphiteInterop = (): boolean => {
		if (!enableGraphiteInterop) {
			toast.info('Graphite interoperability is disabled by feature flag');
			return false;
		}
		if (!graphiteCliAvailable) {
			toast.info('Graphite CLI is unavailable. Local stack mode remains active.');
			return false;
		}
		return true;
	};

	const handleRestack = async () => {
		if (!requireGraphiteInterop()) {
			return;
		}
		const result = await restackMutation.mutateAsync({ repo: activeRepo });
		if (!result.success) {
			toast.error(result.error ?? 'Restack failed');
		} else {
			toast.success('Restack completed');
		}
		void refetchRepoInfo();
	};

	const handleImportGraphiteStack = async () => {
		if (!requireGraphiteInterop()) {
			return;
		}
			const result = await importStackQuery.refetch();
			const payload = result.data as GraphiteImportResult | undefined;
			if (!payload) {
				toast.error('Unable to import stack metadata');
				return;
			}
			if (payload.error) {
				toast.error(payload.error);
				return;
			}
			const stackItems = payload.stack ?? [];
			if (stackItems.length === 0) {
				toast.info('No Graphite stack entries found');
				return;
			}

			const existingByName = new Map(stack.map((entry) => [entry.name, entry]));
			for (const item of stackItems) {
				if (!existingByName.has(item.branch)) {
					addBranch(activeRepo, {
						name: item.branch,
					baseBranch: item.parent ?? defaultBaseBranch,
					parentId: null,
					commitHash: 'HEAD',
					status: 'draft',
				});
			}
		}

		const refreshed = getStack(activeRepo);
		const idByName = new Map(refreshed.map((entry) => [entry.name, entry.id]));
			for (const item of stackItems) {
				const id = idByName.get(item.branch);
				if (!id) continue;
				updateBranch(activeRepo, id, {
				parentId: item.parent ? idByName.get(item.parent) ?? null : null,
				baseBranch: item.parent ?? defaultBaseBranch,
			});
		}

			toast.success(`Imported ${String(stackItems.length)} stack entries`);
		};

	const handleExportGraphiteStack = async () => {
		if (!requireGraphiteInterop()) {
			return;
		}
			const result = (await exportStackMutation.mutateAsync({
				repo: activeRepo,
				stack: sortedStack.map((entry): GraphiteStackItem => ({
					branch: entry.name,
					parent: sortedStack.find((candidate) => candidate.id === entry.parentId)?.name ?? null,
				})),
			})) as GraphiteSyncResult;

		if (!result.success) {
			toast.error(result.error ?? 'Export failed');
			return;
		}
		toast.success('Stack metadata exported');
	};

	return (
		<Sheet>
			<SheetTrigger>
				{children || (
					<Button variant='ghost' size='sm' className='gap-1.5'>
						<GitBranch className='h-4 w-4' />
						<span className='hidden sm:inline'>Stack</span>
						{stack.length > 0 && (
							<Badge variant='secondary' className='h-5 px-1.5 text-xs'>
								{stack.length}
							</Badge>
						)}
					</Button>
				)}
			</SheetTrigger>
			<SheetContent className='w-80 sm:w-96'>
				<SheetHeader className='mb-4'>
					<SheetTitle className='flex items-center gap-2'>
						<GitBranch className='h-5 w-5' />
						Branch Stack
					</SheetTitle>
				</SheetHeader>

				<div className='mb-3 flex flex-wrap items-center gap-2'>
					<Button variant='outline' size='sm' className='flex-1' onClick={handleAddCurrentBranch}>
						<Plus className='mr-1 h-4 w-4' />
						Add Current Branch
					</Button>
					<Button
						variant='outline'
						size='sm'
						className='flex-1'
						onClick={() => {
							void handleRestack();
						}}
						disabled={!graphiteInteropEnabled || restackMutation.isPending}>
						{restackMutation.isPending ? (
							<Loader2 className='mr-1 h-4 w-4 animate-spin' />
						) : (
							<RefreshCw className='mr-1 h-4 w-4' />
						)}
						Restack
					</Button>
					<Button
						variant='outline'
						size='sm'
						className='flex-1'
						onClick={() => {
							void handleSyncStack();
						}}
						disabled={!enableGraphiteInterop || syncStackMutation.isPending}>
						{syncStackMutation.isPending ? (
							<Loader2 className='mr-1 h-4 w-4 animate-spin' />
						) : (
							<GitPullRequest className='mr-1 h-4 w-4' />
						)}
						Sync PRs
					</Button>
					<Button
						variant='outline'
						size='sm'
						className='flex-1'
						onClick={() => {
							void handleImportGraphiteStack();
						}}
						disabled={!graphiteInteropEnabled || importStackQuery.isFetching}>
						{importStackQuery.isFetching ? (
							<Loader2 className='mr-1 h-4 w-4 animate-spin' />
						) : (
							<Download className='mr-1 h-4 w-4' />
						)}
						Import
					</Button>
					<Button
						variant='outline'
						size='sm'
						className='flex-1'
						onClick={() => {
							void handleExportGraphiteStack();
						}}
						disabled={!graphiteInteropEnabled || exportStackMutation.isPending}>
						{exportStackMutation.isPending ? (
							<Loader2 className='mr-1 h-4 w-4 animate-spin' />
						) : (
							<ExternalLink className='mr-1 h-4 w-4' />
						)}
						Export
					</Button>
					<Button
						variant='ghost'
						size='sm'
						onClick={() => {
							void refetchRepoInfo();
							void refetchRemotes();
						}}>
						<RefreshCw className='h-4 w-4' />
					</Button>
				</div>

				{!enableGraphiteInterop && (
					<div className='mb-3 rounded-md border border-muted-foreground/30 bg-muted/40 p-2 text-xs text-muted-foreground'>
						Graphite interoperability is disabled by feature flag. Local stacked branches remain available.
					</div>
				)}
				{graphiteFallbackLocalMode && (
					<div className='mb-3 rounded-md border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-200'>
						<div className='mb-1 flex items-center gap-1 font-medium'>
							<Link2Off className='h-3.5 w-3.5' />
							Graphite CLI unavailable
						</div>
						<p>Using local stack mode. Sync still works, but restack/import/export require Graphite CLI.</p>
						{graphiteStatusError && <p className='mt-1'>{graphiteStatusError}</p>}
					</div>
				)}

				{integrityWarnings.length > 0 && (
					<div className='mb-3 rounded-md border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-200'>
						{integrityWarnings.map((warning) => (
							<p key={warning}>{warning}</p>
						))}
					</div>
				)}
				{backendValidationWarnings.length > 0 && (
					<div className='mb-3 rounded-md border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-200'>
						{backendValidationWarnings.map((warning) => (
							<p key={warning}>{warning}</p>
						))}
					</div>
				)}

				<ScrollArea className='h-[calc(100vh-8rem)]'>
					{sortedStack.length === 0 ? (
						<div className='py-8 text-center text-muted-foreground'>
							<GitBranch className='mx-auto mb-3 h-12 w-12 opacity-30' />
							<p>No stacked branches</p>
							<p className='mt-1 text-xs'>Create dependent branches to build a stack</p>
							<Button variant='outline' size='sm' className='mt-4' onClick={handleAddCurrentBranch}>
								<Plus className='mr-1 h-4 w-4' />
								Add Current Branch
							</Button>
						</div>
					) : (
						<div className='space-y-1'>
							<p className='mb-3 text-xs text-muted-foreground'>
								{sortedStack.length} branch{sortedStack.length !== 1 ? 'es' : ''} in stack
							</p>
							{sortedStack.map((branch, index) => (
								<StackedBranchItem
									key={branch.id}
									branch={branch}
									index={index}
									isLast={index === sortedStack.length - 1}
									isCreatingPr={creatingPrBranchId === branch.id}
									onMoveUp={() => {
										if (index > 0) {
											const above = sortedStack[index - 1];
											if (above) {
												if (isDescendant(above.parentId, branch.id)) {
													toast.error('Cannot reorder: this would create a cycle');
													return;
												}
												reorderBranch(activeRepo, branch.id, above.parentId);
											}
										}
									}}
									onMoveDown={() => {
										if (index < sortedStack.length - 1) {
											const below = sortedStack[index + 1];
											if (below) {
												if (isDescendant(below.id, branch.id)) {
													toast.error('Cannot reorder: this would create a cycle');
													return;
												}
												reorderBranch(activeRepo, branch.id, below.id);
											}
										}
									}}
									onRemove={() => {
										removeBranch(activeRepo, branch.id);
									}}
									onCreatePr={() => {
										void handleCreateStackedPr(branch);
									}}
								/>
							))}
						</div>
					)}
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}

interface StackedBranchItemProps {
	branch: StackedBranch;
	index: number;
	isLast: boolean;
	isCreatingPr: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onRemove: () => void;
	onCreatePr: () => void;
}

function StackedBranchItem({
	branch,
	index,
	isLast,
	isCreatingPr,
	onMoveUp,
	onMoveDown,
	onRemove,
	onCreatePr,
}: StackedBranchItemProps) {
	const StatusIcon = STATUS_CONFIG[branch.status].icon;
	const statusConfig = STATUS_CONFIG[branch.status];

	return (
		<div className="relative">
			{!isLast && (
				<div className="absolute left-4 top-10 bottom-0 w-0.5 bg-border" />
			)}
			<div
				className={cn(
					'flex items-start gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors',
					index === 0 && 'border-green-500/30'
				)}
			>
				<div className="mt-0.5">
					<GitBranch className="h-4 w-4 text-muted-foreground" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm truncate">{branch.name}</span>
						<Badge
							variant="secondary"
							className={cn('gap-1 text-xs', statusConfig.color)}
						>
							<StatusIcon className="h-3 w-3" />
							{statusConfig.label}
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Based on: {branch.baseBranch}
					</p>
					{branch.syncState && (
						<p
							className={cn(
								'mt-1 text-[11px]',
								branch.syncState === 'error'
									? 'text-red-600'
									: branch.syncState === 'warning'
										? 'text-amber-600'
										: 'text-emerald-600'
							)}
						>
							{branch.syncMessage ?? 'Synced'}
						</p>
					)}
					{branch.baseDrift && (
						<p className='mt-1 text-[11px] text-amber-600'>Base drift detected</p>
					)}
					{branch.prUrl && (
						<a
							href={branch.prUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
						>
							<GitPullRequest className="h-3 w-3" />
							View PR
							<ExternalLink className="h-2 w-2" />
						</a>
					)}
				</div>
				<div className="flex flex-col gap-1">
					{branch.status !== 'merged' && (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0 text-indigo-600"
							onClick={onCreatePr}
						>
							{isCreatingPr ? <Loader2 className='h-3 w-3 animate-spin' /> : <GitPullRequest className='h-3 w-3' />}
						</Button>
					)}
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={onMoveUp}
						disabled={index === 0}
					>
						<ArrowUp className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0"
						onClick={onMoveDown}
						disabled={isLast}
					>
						<ArrowDown className="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0 text-red-500"
						onClick={onRemove}
					>
						<Trash2 className="h-3 w-3" />
					</Button>
				</div>
			</div>
		</div>
	);
}

function detectProvider(remoteUrl: string): PullRequestProvider | null {
	const url = remoteUrl.toLowerCase();
	if (!url) return null;
	if (url.includes('github.com')) return 'github';
	if (url.includes('gitlab')) return 'gitlab';
	if (url.includes('bitbucket.org')) return 'bitbucket';
	if (url.includes('dev.azure.com') || url.includes('visualstudio.com') || url.includes('ssh.dev.azure.com')) {
		return 'azure';
	}
	return null;
}
