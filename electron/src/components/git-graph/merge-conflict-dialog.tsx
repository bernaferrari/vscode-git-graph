/**
 * Merge Conflict Resolution UI
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ConflictFile {
	path: string;
	status: 'both-modified' | 'deleted-by-them' | 'deleted-by-us' | 'both-added';
}

interface MergeConflictDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	repo: string;
	onAbort: () => void;
	onComplete: () => void;
}

export function MergeConflictDialog({
	open,
	onOpenChange,
	repo,
	onAbort,
	onComplete,
}: MergeConflictDialogProps) {
	const [conflicts, setConflicts] = useState<ConflictFile[]>([]);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);

	// Get conflict status
	const { data: status } = trpc.git.workingDirectoryStatus.useQuery(
		{ repo },
		{ enabled: open && !!repo }
	);

	useEffect(() => {
		if (status?.conflicted) {
			setConflicts(status.conflicted.map((f: string) => ({
				path: f,
				status: 'both-modified' as const,
			})));
		}
	}, [status]);

	const abortMutation = trpc.git.mergeAbort.useMutation({
		onSuccess: () => {
			onAbort();
			onOpenChange(false);
		},
	});

	const resolveMutation = trpc.git.resolveConflict.useMutation();

	const handleResolve = (path: string, resolution: 'ours' | 'theirs' | 'both') => {
		resolveMutation.mutate({ repo, path, resolution }, {
			onSuccess: () => {
				setConflicts((prev) => prev.filter((c) => c.path !== path));
			},
		});
	};

	const handleAbort = () => {
		abortMutation.mutate({ repo });
	};

	const handleComplete = () => {
		onComplete();
		onOpenChange(false);
	};

	if (!open) return null;

	const hasConflicts = conflicts.length > 0;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
			<Card className="relative z-50 w-full max-w-4xl mx-4 max-h-[80vh]">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<span>Merge Conflicts</span>
						<Badge variant="destructive">{conflicts.length} conflicts</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className="flex gap-4">
					{/* Conflict list */}
					<div className="w-64 shrink-0">
						<ScrollArea className="h-[400px]">
							<div className="space-y-1">
								{conflicts.map((conflict) => (
									<button
										key={conflict.path}
										onClick={() => setSelectedFile(conflict.path)}
										className={`w-full text-left p-2 rounded text-sm hover:bg-accent ${
											selectedFile === conflict.path ? 'bg-accent' : ''
										}`}
									>
										<div className="flex items-center gap-2">
											<span className="w-2 h-2 rounded-full bg-destructive" />
											<span className="truncate">{conflict.path}</span>
										</div>
										<span className="text-xs text-muted-foreground ml-4">
											{conflict.status}
										</span>
									</button>
								))}
							</div>
						</ScrollArea>
					</div>

					<Separator orientation="vertical" />

					{/* Resolution panel */}
					<div className="flex-1">
						{selectedFile ? (
							<div className="space-y-4">
								<div className="font-medium">{selectedFile}</div>
								
								<ScrollArea className="h-[280px] border rounded p-2 font-mono text-xs bg-muted">
									<pre className="whitespace-pre-wrap">
										{`<<<<<<< HEAD
Current branch changes
=======
Incoming changes from merge
>>>>>>> feature-branch`}
									</pre>
								</ScrollArea>

								<div className="space-y-2">
									<p className="text-sm text-muted-foreground">
										Choose how to resolve this conflict:
									</p>
									<div className="flex gap-2">
										<Button
											variant="outline"
											onClick={() => handleResolve(selectedFile, 'ours')}
										>
											Keep Current
										</Button>
										<Button
											variant="outline"
											onClick={() => handleResolve(selectedFile, 'theirs')}
										>
											Keep Incoming
										</Button>
										<Button
											variant="outline"
											onClick={() => handleResolve(selectedFile, 'both')}
										>
											Keep Both
										</Button>
									</div>
								</div>
							</div>
						) : (
							<div className="h-[340px] flex items-center justify-center text-muted-foreground">
								Select a file to resolve
							</div>
						)}
					</div>
				</CardContent>
				<CardFooter className="justify-between">
					<Button variant="destructive" onClick={handleAbort}>
						Abort Merge
					</Button>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleComplete}
							disabled={hasConflicts}
						>
							Commit Merge
						</Button>
					</div>
				</CardFooter>
			</Card>
		</div>
	);
}
