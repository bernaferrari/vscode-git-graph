/**
 * LFS Management Panel
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LFSPanelProps {
	repo: string;
}

export function LFSPanel({ repo }: LFSPanelProps) {
	const utils = trpc.useUtils();
	const { data: lfsStatus, isLoading } = trpc.git.lfs.status.useQuery(
		{ repo },
		{ enabled: !!repo }
	);

	const trackMutation = trpc.git.lfs.track.useMutation({
		onSuccess: () => utils.git.lfs.status.invalidate(),
	});

	const untrackMutation = trpc.git.lfs.untrack.useMutation({
		onSuccess: () => utils.git.lfs.status.invalidate(),
	});

	const pullMutation = trpc.git.lfs.pull.useMutation();
	const pushMutation = trpc.git.lfs.push.useMutation();
	const pruneMutation = trpc.git.lfs.prune.useMutation();

	const [pattern, setPattern] = useState('');

	const handleTrack = () => {
		if (pattern.trim()) {
			trackMutation.mutate({ repo, pattern });
			setPattern('');
		}
	};

	const handleUntrack = (p: string) => {
		untrackMutation.mutate({ repo, pattern: p });
	};

	const isInstalled = lfsStatus?.installed ?? false;
	const tracking = lfsStatus?.trackingPatterns ?? lfsStatus?.tracking ?? [];
	const trackedFiles = lfsStatus?.trackedFiles ?? [];
	const summary = lfsStatus?.summary;

	if (isLoading) {
		return (
			<Card className="h-full">
				<CardContent className="flex items-center justify-center h-full">
					<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center justify-between">
					<span>Git LFS</span>
					<Badge variant={isInstalled ? 'default' : 'secondary'}>
						{isInstalled ? 'Installed' : 'Not Installed'}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{!isInstalled && (
					<Alert>
						<AlertDescription className="text-xs">
							Git LFS is not installed or not available. Install it to track large files.
						</AlertDescription>
					</Alert>
				)}

				{isInstalled && (
					<>
						{/* Actions */}
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => pullMutation.mutate({ repo })}
								disabled={pullMutation.isPending}
							>
								{pullMutation.isPending ? 'Pulling...' : 'Pull LFS'}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => pushMutation.mutate({ repo })}
								disabled={pushMutation.isPending}
							>
								{pushMutation.isPending ? 'Pushing...' : 'Push LFS'}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => pruneMutation.mutate({ repo })}
								disabled={pruneMutation.isPending}
							>
								Prune Old Files
							</Button>
						</div>

						{/* Track pattern */}
						<div className="flex gap-2">
							<Input
								value={pattern}
								onChange={(e) => setPattern(e.target.value)}
								placeholder="*.psd, *.zip, etc."
								className="h-8"
								onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
							/>
							<Button
								size="sm"
								onClick={handleTrack}
								disabled={!pattern || trackMutation.isPending}
							>
								Track
							</Button>
						</div>

						{/* Tracked files */}
						<div className="space-y-1">
							<div className="text-xs font-medium text-muted-foreground">
								Tracked Patterns ({tracking.length})
							</div>
							<ScrollArea className="h-32">
								{tracking.length > 0 ? (
									<div className="space-y-1">
										{tracking.map((pattern: string) => (
											<div
												key={pattern}
												className="flex items-center justify-between p-1 rounded hover:bg-accent text-xs"
											>
												<span className="truncate font-mono">{pattern}</span>
												<Button
													variant="ghost"
													size="sm"
													className="h-5 px-1"
													onClick={() => handleUntrack(pattern)}
												>
													Untrack
												</Button>
											</div>
										))}
									</div>
								) : (
									<div className="text-center text-muted-foreground text-xs py-4">
										No LFS patterns configured
									</div>
								)}
							</ScrollArea>
						</div>

						<div className="text-xs text-muted-foreground">
							Tracked files: {summary?.trackedFileCount ?? trackedFiles.length}
							{summary?.totalSizeLabel ? ` • Size: ${summary.totalSizeLabel}` : ''}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
