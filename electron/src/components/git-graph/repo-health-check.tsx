import { Check, X, AlertTriangle, Loader2, RefreshCw, Activity } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

interface HealthCheck {
	id: string;
	label: string;
	description: string;
	status: 'pass' | 'warn' | 'fail';
	detail?: string;
	metrics?: Record<string, number | string | boolean | null>;
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

	const repoHealthQuery = trpc.git.repoHealth.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: false, retry: false }
	);

	const runHealthCheck = async () => {
		if (!activeRepo) return;

		setIsRunning(true);
		try {
			const result = await repoHealthQuery.refetch();
			if (result.data?.error) {
				setChecks([
					{
						id: 'diagnostics-error',
						label: 'Diagnostics Failed',
						description: 'Repository health checks could not complete.',
						status: 'fail',
						detail: result.data.error,
					},
				]);
				setScore(0);
				return;
			}
			setChecks((result.data?.checks ?? []) as HealthCheck[]);
			setScore(result.data?.score ?? 0);
		} finally {
			setIsRunning(false);
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'pass': return <Check className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />;
			case 'warn': return <AlertTriangle className="h-4 w-4 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]" />;
			case 'fail': return <X className="h-4 w-4 text-destructive" />;
			default: return null;
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'pass': return 'border-[color-mix(in_oklch,var(--success)_25%,transparent)] bg-[color-mix(in_oklch,var(--success)_10%,transparent)]';
			case 'warn': return 'border-[color-mix(in_oklch,var(--warning)_25%,transparent)] bg-[color-mix(in_oklch,var(--warning)_10%,transparent)]';
			case 'fail': return 'border-destructive/25 bg-destructive/10';
			default: return 'border-border/70 bg-muted/20';
		}
	};

	const scoreTone =
		score >= 80 ? 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' : score >= 50 ? 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]' : 'text-destructive';

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="ui-surface flex max-h-[85vh] max-w-2xl flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Activity className="h-4 w-4" />
						Health
					</DialogTitle>
				</DialogHeader>

				{checks.length > 0 && (
					<div className="border-border/70 flex items-center gap-4 border-b pb-4">
						<div className="flex-1">
							<p className="mb-2 text-sm font-medium">Score</p>
							<Progress value={score} className="h-2" />
						</div>
						<div className={`text-2xl font-semibold tabular-nums ${scoreTone}`}>
							{score}%
						</div>
					</div>
				)}

				<ScrollArea className="flex-1">
					{checks.length === 0 ? (
						<div className="py-12 text-center">
							<Activity className="text-muted-foreground mx-auto mb-3 h-9 w-9 opacity-45" />
							<p className="text-foreground text-sm font-medium">Run diagnostics.</p>
						</div>
					) : (
						<div className="space-y-3">
							{checks.map((check) => (
								<div
									key={check.id}
									className={`rounded-lg border p-3 ${getStatusColor(check.status)}`}
								>
									<div className="flex items-start gap-3">
										<div className="mt-0.5">
											{getStatusIcon(check.status)}
										</div>
										<div className="flex-1">
											<div className="mb-1 flex items-center justify-between gap-3">
												<span className="font-medium">{check.label}</span>
												<Badge variant="outline" className="uppercase">
													{check.status}
												</Badge>
											</div>
											<p className="text-muted-foreground mb-1 text-sm">
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

				<div className="border-border/70 flex justify-end gap-2 border-t pt-4">
					<Button variant="outline" onClick={() => { setChecks([]); }}>
						Clear
					</Button>
					<Button onClick={() => { void runHealthCheck(); }} disabled={isRunning || !activeRepo}>
						{isRunning ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4 mr-2" />
						)}
						{checks.length > 0 ? 'Re-run' : 'Run'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default RepoHealthCheck;
