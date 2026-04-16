/**
 * Outcome Preview Dialog
 * Shows what will happen before merge/rebase operations
 */

import {
	GitCommit,
	Merge,
	RotateCcw,
	AlertTriangle,
	CheckCircle2,
	ArrowRight,
	Shield,
	ShieldAlert,
	ShieldCheck,
	AlertCircle,
	Files,
	Loader2,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import type { OutcomePreview } from '@/lib/outcomePreview';

interface OutcomePreviewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	preview: OutcomePreview | null;
	onApply: () => void;
	onCancel: () => void;
	isLoading?: boolean;
}

const RISK_CONFIG = {
	low: {
		icon: ShieldCheck,
		color: 'text-green-500',
		bgColor: 'bg-green-50 dark:bg-green-950/30 border-green-200',
		label: 'Low Risk',
	},
	medium: {
		icon: Shield,
		color: 'text-amber-500',
		bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200',
		label: 'Medium Risk',
	},
	high: {
		icon: ShieldAlert,
		color: 'text-red-500',
		bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200',
		label: 'High Risk',
	},
};

export function OutcomePreviewDialog({
	open,
	onOpenChange,
	preview,
	onApply,
	onCancel,
	isLoading,
}: OutcomePreviewDialogProps) {
	const [showGhostOverlay, setShowGhostOverlay] = useState(true);

	if (!preview) return null;

	const riskConfig = RISK_CONFIG[preview.riskLevel];
	const RiskIcon = riskConfig.icon;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{preview.operation === 'merge' ? (
							<Merge className="h-5 w-5 text-purple-500" />
						) : preview.operation === 'rebase' ? (
							<RotateCcw className="h-5 w-5 text-blue-500" />
						) : (
							<GitCommit className="h-5 w-5 text-amber-500" />
						)}
						Preview: {preview.operation.charAt(0).toUpperCase() + preview.operation.slice(1)} {preview.sourceRef} onto {preview.targetRef}
					</DialogTitle>
					<DialogDescription>
						See exactly what will happen before making any changes
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto space-y-4">
					{/* Risk Assessment */}
					<Card className={riskConfig.bgColor}>
						<CardContent className="p-4">
							<div className="flex items-start gap-3">
								<RiskIcon className={cn('h-6 w-6 mt-0.5', riskConfig.color)} />
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-1">
										<span className="font-medium">{riskConfig.label}</span>
										<Badge variant="outline" className="text-xs">
											~{preview.estimatedDuration}
										</Badge>
									</div>
									{preview.riskReasons.length > 0 && (
										<ul className="text-sm text-muted-foreground space-y-1">
										{preview.riskReasons.map((reason, index) => (
											<li key={index} className="flex items-center gap-2">
													<AlertTriangle className="h-3 w-3 text-amber-500" />
													{reason}
												</li>
											))}
										</ul>
									)}
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Impact Summary */}
					<div className="grid grid-cols-3 gap-3">
						<Card>
							<CardContent className="p-3 flex items-center gap-2">
								<GitCommit className="h-5 w-5 text-blue-500" />
								<div>
									<p className="text-2xl font-semibold">
										{preview.commits.filter(c => c.action !== 'dropped').length}
									</p>
									<p className="text-xs text-muted-foreground">Commits</p>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3 flex items-center gap-2">
								<Files className="h-5 w-5 text-green-500" />
								<div>
									<p className="text-2xl font-semibold">{preview.filesChanged}</p>
									<p className="text-xs text-muted-foreground">Files</p>
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-3 flex items-center gap-2">
								{preview.conflictsCount > 0 ? (
									<AlertCircle className="h-5 w-5 text-red-500" />
								) : (
									<CheckCircle2 className="h-5 w-5 text-green-500" />
								)}
								<div>
									<p className="text-2xl font-semibold">{preview.conflictsCount}</p>
									<p className="text-xs text-muted-foreground">Conflicts</p>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Warnings */}
					{preview.willRewriteHistory && (
						<div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200">
							<AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
							<div>
								<p className="font-medium text-amber-800 dark:text-amber-200">
									This will rewrite history
								</p>
								<p className="text-sm text-amber-700 dark:text-amber-300">
									The commit hashes will change. If this branch is shared, you'll need to force push.
								</p>
							</div>
						</div>
					)}

					{preview.willForcePush && (
						<div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200">
							<AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
							<div>
								<p className="font-medium text-red-800 dark:text-red-200">
									Force push required
								</p>
								<p className="text-sm text-red-700 dark:text-red-300">
									The remote already has commits. Use force-with-lease for safety.
								</p>
							</div>
						</div>
					)}

					{/* Graph Preview */}
					<Card>
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<CardTitle className="text-sm">Commit Graph</CardTitle>
								<div className="flex items-center gap-2">
									<label className="flex items-center gap-2 text-xs text-muted-foreground">
										<input
											type="checkbox"
											checked={showGhostOverlay}
											onChange={(e) => { setShowGhostOverlay(e.target.checked); }}
											className="rounded"
										/>
										Show "After" overlay
									</label>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="relative min-h-[200px] bg-muted/30 rounded-lg p-4 overflow-x-auto">
								{/* Simplified graph visualization */}
								<div className="flex gap-4">
									{/* Before */}
									<div className="flex-1">
										<p className="text-xs text-muted-foreground mb-2">Before</p>
										<div className="space-y-1">
											{preview.commits.slice(0, 5).map((commit) => (
												<div
													key={commit.hash}
													className={cn(
														'flex items-center gap-2 text-xs p-1.5 rounded',
														commit.action === 'dropped' && 'line-through text-muted-foreground'
													)}
												>
													<div className="w-2 h-2 rounded-full bg-blue-500" />
													<span className="font-mono truncate">{commit.hash.substring(0, 7)}</span>
													<span className="truncate">{commit.message.substring(0, 30)}</span>
												</div>
											))}
										</div>
									</div>
									
									<div className="flex items-center">
										<ArrowRight className="h-5 w-5 text-muted-foreground" />
									</div>

									{/* After */}
									<div className="flex-1">
										<p className="text-xs text-muted-foreground mb-2">After</p>
										<div className="space-y-1">
											{preview.commits.slice(0, 5).map((commit) => {
												const newHash = (commit as { newHash?: string }).newHash;
												return (
												<div
													key={commit.hash}
													className={cn(
														'flex items-center gap-2 text-xs p-1.5 rounded',
														showGhostOverlay && commit.action !== 'unchanged' && 'bg-green-50 dark:bg-green-950/30 border border-green-200',
														commit.action === 'dropped' && 'line-through opacity-50'
													)}
												>
													<div className={cn(
														'w-2 h-2 rounded-full',
														commit.action === 'unchanged' && 'bg-blue-500',
														commit.action === 'new' && 'bg-green-500',
														commit.action === 'rewritten' && 'bg-amber-500',
														commit.action === 'dropped' && 'bg-red-500'
													)} />
													<span className="font-mono truncate">
														{commit.action === 'unchanged' 
															? commit.hash.substring(0, 7)
															: newHash?.substring(0, 7) || '(new)'
														}
													</span>
													<span className="truncate">{commit.message.substring(0, 30)}</span>
												</div>
												);
											})}
										</div>
									</div>
								</div>
							</div>
							
							{/* Legend */}
							<div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
								<div className="flex items-center gap-1">
									<div className="w-2 h-2 rounded-full bg-blue-500" />
									<span>Unchanged</span>
								</div>
								<div className="flex items-center gap-1">
									<div className="w-2 h-2 rounded-full bg-green-500" />
									<span>New</span>
								</div>
								<div className="flex items-center gap-1">
									<div className="w-2 h-2 rounded-full bg-amber-500" />
									<span>Rewritten</span>
								</div>
								<div className="flex items-center gap-1">
									<div className="w-2 h-2 rounded-full bg-red-500" />
									<span>Dropped</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Git Commands */}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm">Git Commands</CardTitle>
						</CardHeader>
						<CardContent>
							<pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-x-auto">
								{preview.gitCommands.map((cmd, index) => (
									<div key={index} className="text-muted-foreground">
										$ {cmd}
									</div>
								))}
							</pre>
						</CardContent>
					</Card>
				</div>

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						variant={preview.riskLevel === 'high' ? 'destructive' : 'default'}
						onClick={onApply}
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Applying...
							</>
						) : (
							<>
								<CheckCircle2 className="h-4 w-4 mr-2" />
								Apply {preview.operation}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
