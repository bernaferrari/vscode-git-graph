/**
 * CI/CD Status Display
 * Uses backend provider APIs (GitHub/GitLab/Bitbucket/Azure) instead of mock status data.
 */

import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, MinusCircle, ExternalLink, RefreshCw, GitBranch } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

import type { ReactNode } from 'react';

export type CIStatus = 'success' | 'failure' | 'pending' | 'running' | 'cancelled' | 'unknown';

interface CIStatusInfo {
	status: CIStatus;
	provider: 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'unknown';
	workflowName?: string | null;
	runId?: string | null;
	url?: string | null;
	error?: string | null;
}

interface CIStatusBadgeProps {
	commitHash: string;
	repo?: string;
	showDetails?: boolean;
}

const STATUS_CONFIG: Record<CIStatus, { color: string; bg: string; icon: ReactNode }> = {
	success: {
		color: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_30%,transparent)]',
		icon: <CheckCircle className='h-3 w-3' />,
	},
	failure: {
		color: 'text-destructive dark:text-destructive',
		bg: 'bg-[color-mix(in_oklch,var(--destructive)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--destructive)_30%,transparent)]',
		icon: <XCircle className='h-3 w-3' />,
	},
	pending: {
		color: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--warning)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--warning)_30%,transparent)]',
		icon: <Clock className='h-3 w-3' />,
	},
	running: {
		color: 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',
		bg: 'bg-[color-mix(in_oklch,var(--info)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--info)_30%,transparent)]',
		icon: <Loader2 className='h-3 w-3 animate-spin' />,
	},
	cancelled: {
		color: 'text-gray-600 dark:text-gray-400',
		bg: 'bg-gray-100 dark:bg-gray-900/30',
		icon: <MinusCircle className='h-3 w-3' />,
	},
	unknown: {
		color: 'text-muted-foreground',
		bg: 'bg-muted',
		icon: <AlertCircle className='h-3 w-3' />,
	},
};

function toCiStatus(value: string): CIStatus {
	if (value === 'success' || value === 'failure' || value === 'pending' || value === 'running' || value === 'cancelled') {
		return value;
	}
	return 'unknown';
}

function useCommitCiStatus(commitHash: string, repo?: string): CIStatusInfo | null {
	const { activeRepo } = useAppStore();
	const effectiveRepo = repo || activeRepo;
	const query = trpc.git.ciStatus.useQuery(
		{ repo: effectiveRepo ?? '', commitHash },
		{ enabled: !!effectiveRepo && !!commitHash, staleTime: 30_000, refetchOnWindowFocus: false }
	);

	return useMemo(() => {
		if (!query.data) return null;
		return {
			status: toCiStatus(query.data.status),
			provider: query.data.provider,
			workflowName: query.data.workflowName,
			runId: query.data.runId,
			url: query.data.url,
			error: query.data.error,
		};
	}, [query.data]);
}

export function CIStatusBadge({ commitHash, repo }: CIStatusBadgeProps) {
	const statusInfo = useCommitCiStatus(commitHash, repo);
	if (!statusInfo || statusInfo.status === 'unknown') return null;

	const config = STATUS_CONFIG[statusInfo.status];

	return (
		<Tooltip>
			<TooltipTrigger>
				<Badge variant='outline' className={`${config.bg} ${config.color} border-0 cursor-pointer`}>
					{config.icon}
				</Badge>
			</TooltipTrigger>
			<TooltipContent side='top' className='max-w-xs'>
				<div className='space-y-2'>
					<div className='flex items-center gap-2'>
						{config.icon}
						<span className='font-medium capitalize'>{statusInfo.status}</span>
					</div>
					{statusInfo.workflowName && <p className='text-xs text-muted-foreground'>{statusInfo.workflowName}</p>}
					{statusInfo.error && <p className='text-xs text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'>{statusInfo.error}</p>}
					{statusInfo.url && (
						<a
							href={statusInfo.url}
							target='_blank'
							rel='noopener noreferrer'
							className='flex items-center gap-1 text-xs text-primary hover:underline'
							onClick={(event) => { event.stopPropagation(); }}>
							<ExternalLink className='h-3 w-3' />
							View details
						</a>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

export function CIStatusMini({ commitHash, repo }: { commitHash: string; repo?: string }) {
	const statusInfo = useCommitCiStatus(commitHash, repo);
	if (!statusInfo || statusInfo.status === 'unknown') return null;

	const config = STATUS_CONFIG[statusInfo.status];
	return <span className={config.color}>{config.icon}</span>;
}

export function CIStatusPanel({ commitHash, repo }: { commitHash: string; repo?: string }) {
	const { activeRepo } = useAppStore();
	const effectiveRepo = repo || activeRepo;
	const query = trpc.git.ciStatus.useQuery(
		{ repo: effectiveRepo ?? '', commitHash },
		{ enabled: !!effectiveRepo && !!commitHash, staleTime: 30_000 }
	);

	const statusInfo = query.data;
	if (!statusInfo || statusInfo.status === 'unknown') return null;

	const config = STATUS_CONFIG[toCiStatus(statusInfo.status)];

	return (
		<div className='border rounded-lg overflow-hidden'>
			<div className='px-3 py-2 bg-muted/50 border-b flex items-center justify-between'>
				<span className='text-sm font-medium flex items-center gap-2'>
					<GitBranch className='h-4 w-4' />
					CI/CD Status
				</span>
				<div className='flex items-center gap-2'>
					<Badge className={`${config.bg} ${config.color} border-0`}>
						{config.icon}
						<span className='ml-1 capitalize'>{statusInfo.status}</span>
					</Badge>
					<Button variant='ghost' size='sm' className='h-7 w-7 p-0' onClick={() => { void query.refetch(); }}>
						<RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />
					</Button>
				</div>
			</div>
			<div className='p-3 space-y-2 text-sm'>
				<div className='flex justify-between'>
					<span className='text-muted-foreground'>Provider</span>
					<span className='uppercase'>{statusInfo.provider}</span>
				</div>
				{statusInfo.workflowName && (
					<div className='flex justify-between'>
						<span className='text-muted-foreground'>Workflow</span>
						<span>{statusInfo.workflowName}</span>
					</div>
				)}
				{statusInfo.runId && (
					<div className='flex justify-between'>
						<span className='text-muted-foreground'>Run</span>
						<span>{statusInfo.runId}</span>
					</div>
				)}
				{statusInfo.error && <p className='text-xs text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'>{statusInfo.error}</p>}
				{statusInfo.url && (
					<a
						href={statusInfo.url}
						target='_blank'
						rel='noopener noreferrer'
						className='inline-flex items-center gap-1 text-primary hover:underline'
					>
						<ExternalLink className='h-3.5 w-3.5' />
						Open run details
					</a>
				)}
			</div>
		</div>
	);
}

export default CIStatusBadge;
