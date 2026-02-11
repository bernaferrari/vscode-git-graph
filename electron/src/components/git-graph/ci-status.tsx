/**
 * CI/CD Status Display
 * Show GitHub Actions/GitLab CI status badges on commits
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	CheckCircle,
	XCircle,
	Clock,
	Loader2,
	AlertCircle,
	MinusCircle,
	GitBranch,
	ExternalLink,
	RefreshCw,
} from 'lucide-react';

export type CIStatus = 'success' | 'failure' | 'pending' | 'running' | 'cancelled' | 'unknown';

interface CIStatusInfo {
	status: CIStatus;
	provider: 'github' | 'gitlab' | 'circleci' | 'travis' | 'unknown';
	workflowName?: string;
	runId?: string;
	url?: string;
	sha?: string;
	startedAt?: string;
	finishedAt?: string;
	duration?: number;
	branches?: string[];
}

interface CIStatusBadgeProps {
	commitHash: string;
	repo?: string;
	showDetails?: boolean;
}

// Map status to colors and icons
const STATUS_CONFIG: Record<CIStatus, { color: string; bg: string; icon: React.ReactNode }> = {
	success: {
		color: 'text-green-600 dark:text-green-400',
		bg: 'bg-green-100 dark:bg-green-900/30',
		icon: <CheckCircle className="h-3 w-3" />,
	},
	failure: {
		color: 'text-red-600 dark:text-red-400',
		bg: 'bg-red-100 dark:bg-red-900/30',
		icon: <XCircle className="h-3 w-3" />,
	},
	pending: {
		color: 'text-amber-600 dark:text-amber-400',
		bg: 'bg-amber-100 dark:bg-amber-900/30',
		icon: <Clock className="h-3 w-3" />,
	},
	running: {
		color: 'text-blue-600 dark:text-blue-400',
		bg: 'bg-blue-100 dark:bg-blue-900/30',
		icon: <Loader2 className="h-3 w-3 animate-spin" />,
	},
	cancelled: {
		color: 'text-gray-600 dark:text-gray-400',
		bg: 'bg-gray-100 dark:bg-gray-900/30',
		icon: <MinusCircle className="h-3 w-3" />,
	},
	unknown: {
		color: 'text-muted-foreground',
		bg: 'bg-muted',
		icon: <AlertCircle className="h-3 w-3" />,
	},
};

// In-memory cache for CI status (would be replaced with proper caching in production)
const statusCache = new Map<string, { status: CIStatusInfo; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export function CIStatusBadge({ commitHash, repo, showDetails = false }: CIStatusBadgeProps) {
	const { activeRepo } = useAppStore();
	const [isRefreshing, setIsRefreshing] = useState(false);
	
	const effectiveRepo = repo || activeRepo;
	const cacheKey = `${effectiveRepo}-${commitHash}`;

	// Get CI status (mock implementation - would connect to actual APIs)
	const statusInfo = useMemo<CIStatusInfo>(() => {
		// Check cache first
		const cached = statusCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.status;
		}

		// In a real implementation, this would:
		// 1. Detect the git remote (GitHub, GitLab, etc.)
		// 2. Make API calls to get CI status
		// 3. Cache the result
		
		// For now, return a mock status based on commit hash
		const hashNum = parseInt(commitHash.slice(0, 4), 16);
		const statuses: CIStatus[] = ['success', 'failure', 'pending', 'running', 'cancelled', 'unknown'];
		const mockStatus = statuses[hashNum % statuses.length];
		
		const status: CIStatusInfo = {
			status: mockStatus,
			provider: 'github',
			workflowName: 'CI',
			runId: `${hashNum}`,
			url: `https://github.com/example/repo/actions/runs/${hashNum}`,
		};

		// Cache it
		statusCache.set(cacheKey, { status, timestamp: Date.now() });
		
		return status;
	}, [cacheKey, commitHash]);

	const config = STATUS_CONFIG[statusInfo.status];

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		// Clear cache and refetch
		statusCache.delete(cacheKey);
		// In real implementation, would refetch from API
		await new Promise(resolve => setTimeout(resolve, 500));
		setIsRefreshing(false);
	}, [cacheKey]);

	if (statusInfo.status === 'unknown') {
		return null;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge 
					variant="outline" 
					className={`${config.bg} ${config.color} border-0 cursor-pointer`}
				>
					{config.icon}
				</Badge>
			</TooltipTrigger>
			<TooltipContent side="top" className="max-w-xs">
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						{config.icon}
						<span className="font-medium capitalize">{statusInfo.status}</span>
					</div>
					{statusInfo.workflowName && (
						<p className="text-xs text-muted-foreground">
							{statusInfo.workflowName}
						</p>
					)}
					{statusInfo.url && (
						<a 
							href={statusInfo.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 text-xs text-primary hover:underline"
							onClick={(e) => e.stopPropagation()}
						>
							<ExternalLink className="h-3 w-3" />
							View details
						</a>
					)}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

// Compact version for commit list
export function CIStatusMini({ commitHash, repo }: { commitHash: string; repo?: string }) {
	const { activeRepo } = useAppStore();
	const effectiveRepo = repo || activeRepo;
	const cacheKey = `${effectiveRepo}-${commitHash}`;

	const statusInfo = useMemo<CIStatusInfo>(() => {
		const cached = statusCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.status;
		}

		const hashNum = parseInt(commitHash.slice(0, 4), 16);
		const statuses: CIStatus[] = ['success', 'failure', 'pending', 'running', 'cancelled', 'unknown'];
		const mockStatus = statuses[hashNum % statuses.length];
		
		return {
			status: mockStatus,
			provider: 'github',
		};
	}, [cacheKey, commitHash]);

	if (statusInfo.status === 'unknown') return null;

	const config = STATUS_CONFIG[statusInfo.status];

	return (
		<span className={`${config.color}`}>
			{config.icon}
		</span>
	);
}

// Full status panel for commit details
export function CIStatusPanel({ commitHash, repo }: { commitHash: string; repo?: string }) {
	const { activeRepo } = useAppStore();
	const effectiveRepo = repo || activeRepo;
	const cacheKey = `${effectiveRepo}-${commitHash}`;

	const statusInfo = useMemo<CIStatusInfo>(() => {
		const cached = statusCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
			return cached.status;
		}

		const hashNum = parseInt(commitHash.slice(0, 4), 16);
		const statuses: CIStatus[] = ['success', 'failure', 'pending', 'running', 'cancelled', 'unknown'];
		const mockStatus = statuses[hashNum % statuses.length];
		
		return {
			status: mockStatus,
			provider: 'github',
			workflowName: 'CI / Build and Test',
			runId: `${hashNum}`,
			url: `https://github.com/example/repo/actions/runs/${hashNum}`,
			startedAt: new Date(Date.now() - 300000).toISOString(),
			finishedAt: mockStatus === 'success' || mockStatus === 'failure' 
				? new Date(Date.now() - 120000).toISOString() 
				: undefined,
			duration: 180,
		};
	}, [cacheKey, commitHash]);

	const config = STATUS_CONFIG[statusInfo.status];

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}m ${secs}s`;
	};

	return (
		<div className="border rounded-lg overflow-hidden">
			<div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
				<span className="text-sm font-medium flex items-center gap-2">
					<GitBranch className="h-4 w-4" />
					CI/CD Status
				</span>
				<Badge className={`${config.bg} ${config.color} border-0`}>
					{config.icon}
					<span className="ml-1 capitalize">{statusInfo.status}</span>
				</Badge>
			</div>
			
			<div className="p-3 space-y-3">
				{statusInfo.workflowName && (
					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">Workflow</span>
						<span className="text-sm font-medium">{statusInfo.workflowName}</span>
					</div>
				)}
				
				{statusInfo.duration && (
					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">Duration</span>
						<span className="text-sm">{formatDuration(statusInfo.duration)}</span>
					</div>
				)}

				{statusInfo.runId && (
					<div className="flex items-center justify-between">
						<span className="text-sm text-muted-foreground">Run ID</span>
						<span className="text-sm font-mono">#{statusInfo.runId}</span>
					</div>
				)}

				{statusInfo.url && (
					<a
						href={statusInfo.url}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center justify-center gap-2 text-sm text-primary hover:underline mt-2"
					>
						<ExternalLink className="h-4 w-4" />
						View on {statusInfo.provider === 'github' ? 'GitHub' : 'GitLab'}
					</a>
				)}
			</div>
		</div>
	);
}

// Hook to fetch CI status for multiple commits
export function useCIStatuses(commitHashes: string[], repo?: string) {
	const { activeRepo } = useAppStore();
	const effectiveRepo = repo || activeRepo;

	return useMemo(() => {
		const statuses = new Map<string, CIStatusInfo>();
		
		for (const hash of commitHashes) {
			const cacheKey = `${effectiveRepo}-${hash}`;
			const cached = statusCache.get(cacheKey);
			
			if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
				statuses.set(hash, cached.status);
				continue;
			}

			// Mock status
			const hashNum = parseInt(hash.slice(0, 4), 16);
			const statusList: CIStatus[] = ['success', 'failure', 'pending', 'unknown'];
			const mockStatus = statusList[hashNum % statusList.length];
			
			const status: CIStatusInfo = {
				status: mockStatus,
				provider: 'github',
			};
			
			statuses.set(hash, status);
			statusCache.set(cacheKey, { status, timestamp: Date.now() });
		}
		
		return statuses;
	}, [commitHashes, effectiveRepo]);
}

export default CIStatusBadge;
