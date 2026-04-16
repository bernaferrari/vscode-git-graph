/**
 * Repository Health Check
 * Diagnose repository issues and show recommendations
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Check,
	X,
	AlertTriangle,
	Loader2,
	RefreshCw,
	Activity,
} from 'lucide-react';

interface HealthCheck {
	id: string;
	label: string;
	description: string;
	status: 'pass' | 'warn' | 'fail';
	detail?: string;
	action?: () => void;
	actionLabel?: string;
}

interface RepoHealthCheckProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function RepoHealthCheck({ open, onOpenChange }: RepoHealthCheckProps) {
	const { activeRepo } = useAppStore();
	const [isRunning, setIsRunning] = useState(false);
	const [checks, setChecks] = useState<HealthCheck[]>([]);
	const [score, setScore] = useState(0);

	// Get repo info
	const { data: statusData } = trpc.git.status.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const { data: branchData } = trpc.git.branches.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const { data: remoteData } = trpc.git.remotes.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const runHealthCheck = async () => {
		if (!activeRepo) return;

		setIsRunning(true);
		const newChecks: HealthCheck[] = [];

		// Check 1: Uncommitted changes
		const hasUncommitted = (statusData?.changes?.length ?? 0) > 0 || (statusData?.untracked?.length ?? 0) > 0;
		newChecks.push({
			id: 'uncommitted',
			label: 'Working Directory',
			description: 'Check for uncommitted changes',
			status: hasUncommitted ? 'warn' : 'pass',
			detail: hasUncommitted 
				? `${statusData?.changes?.length ?? 0} modified, ${statusData?.untracked?.length ?? 0} untracked`
				: 'Clean working directory',
		});

		// Check 2: Remote configured
		const hasRemote = (remoteData?.remotes?.length ?? 0) > 0;
		newChecks.push({
			id: 'remote',
			label: 'Remote Configuration',
			description: 'Check if remotes are configured',
			status: hasRemote ? 'pass' : 'warn',
			detail: hasRemote 
				? `${remoteData?.remotes?.length} remote(s) configured`
				: 'No remotes configured',
		});

		// Check 3: Default branch
		const hasMain = branchData?.branches?.some((branch: { name: string }) => branch.name === 'main' || branch.name === 'master');
		newChecks.push({
			id: 'default-branch',
			label: 'Default Branch',
			description: 'Check for main/master branch',
			status: hasMain ? 'pass' : 'warn',
			detail: hasMain 
				? 'Default branch exists'
				: 'No main/master branch found',
		});

		// Check 4: Large files (placeholder - would need actual implementation)
		newChecks.push({
			id: 'large-files',
			label: 'Large Files',
			description: 'Check for large files in repo',
			status: 'pass',
			detail: 'No large files detected (placeholder)',
		});

		// Check 5: Merge conflicts
		const hasConflicts = (statusData?.conflicted?.length ?? 0) > 0;
		newChecks.push({
			id: 'conflicts',
			label: 'Merge Conflicts',
			description: 'Check for unresolved conflicts',
			status: hasConflicts ? 'fail' : 'pass',
			detail: hasConflicts 
				? `${statusData?.conflicted?.length} conflict(s) need resolution`
				: 'No merge conflicts',
		});

		// Check 6: Stale branches (placeholder)
		newChecks.push({
			id: 'stale-branches',
			label: 'Branch Hygiene',
			description: 'Check for merged/stale branches',
			status: branchData?.branches?.length && branchData.branches.length > 10 ? 'warn' : 'pass',
			detail: `${branchData?.branches?.length ?? 0} branches`,
		});

		setChecks(newChecks);

		// Calculate score
		const passCount = newChecks.filter(c => c.status === 'pass').length;
		const warnCount = newChecks.filter(c => c.status === 'warn').length;
		const calculatedScore = Math.round((passCount * 100 + warnCount * 50) / newChecks.length);
		setScore(calculatedScore);

		setIsRunning(false);
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'pass': return <Check className="h-4 w-4 text-green-600" />;
			case 'warn': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
			case 'fail': return <X className="h-4 w-4 text-red-600" />;
			default: return null;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'pass': return 'border-green-200 bg-green-50 dark:bg-green-950/30';
			case 'warn': return 'border-amber-200 bg-amber-50 dark:bg-amber-950/30';
			case 'fail': return 'border-red-200 bg-red-50 dark:bg-red-950/30';
			default: return '';
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Activity className="h-5 w-5" />
						Repository Health Check
					</DialogTitle>
				</DialogHeader>

				{checks.length > 0 && (
					<div className="flex items-center gap-4 py-4 border-b">
						<div className="flex-1">
							<p className="text-sm font-medium mb-2">Health Score</p>
							<Progress value={score} className="h-2" />
						</div>
						<div className="text-3xl font-bold" style={{
							color: score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
						}}>
							{score}%
						</div>
					</div>
				)}

				<ScrollArea className="flex-1">
					{checks.length === 0 ? (
						<div className="text-center py-12">
							<Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
							<p className="text-muted-foreground mb-4">
								Click "Run Check" to analyze your repository
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{checks.map((check) => (
								<div
									key={check.id}
									className={`p-4 rounded-lg border ${getStatusColor(check.status)}`}
								>
									<div className="flex items-start gap-3">
										<div className="mt-0.5">
											{getStatusIcon(check.status)}
										</div>
										<div className="flex-1">
											<div className="flex items-center justify-between mb-1">
												<span className="font-medium">{check.label}</span>
												<span className="text-xs uppercase font-medium">
													{check.status}
												</span>
											</div>
											<p className="text-sm text-muted-foreground mb-1">
												{check.description}
											</p>
											<p className="text-sm">
												{check.detail}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="flex justify-end gap-2 pt-4 border-t">
					<Button variant="outline" onClick={() => setChecks([])}>
						Clear
					</Button>
					<Button onClick={runHealthCheck} disabled={isRunning || !activeRepo}>
						{isRunning ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4 mr-2" />
						)}
						{checks.length > 0 ? 'Re-run Check' : 'Run Check'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default RepoHealthCheck;
