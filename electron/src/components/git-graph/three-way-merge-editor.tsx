/**
 * Three-Way Merge Editor
 * Resolve merge conflicts with 3-way diff view
 */

import {
	GitMerge,
	Check,
	ArrowLeft,
	ArrowRight,
	Loader2,
	AlertTriangle,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


interface ConflictHunk {
	startLine: number;
	endLine: number;
	ours: string[];
	theirs: string[];
	base?: string[];
	separator: string;
}

interface ThreeWayMergeEditorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	filePath: string;
	onResolved?: () => void;
}

export function ThreeWayMergeEditor({ open, onOpenChange, filePath, onResolved }: ThreeWayMergeEditorProps) {
	const { activeRepo } = useAppStore();
	const [resolutions, setResolutions] = useState<Map<number, 'ours' | 'theirs' | 'both' | 'manual'>>(new Map());
	const [isSaving, setIsSaving] = useState(false);
	const writeFileMutation = trpc.git.writeFile.useMutation();
	const stageMutation = trpc.git.stage.useMutation();

	// Parse conflict markers from file content
	const parseConflicts = (content: string): ConflictHunk[] => {
		const hunks: ConflictHunk[] = [];
		const lines = content.split('\n');
		let currentHunk: Partial<ConflictHunk> | null = null;
		let section: 'ours' | 'separator' | 'theirs' = 'ours';

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) {
				continue;
			}

			if (line.startsWith('<<<<<<<')) {
				currentHunk = { startLine: i, ours: [], theirs: [] };
				section = 'ours';
			} else if (line.startsWith('=======')) {
				section = 'theirs';
			} else if (line.startsWith('>>>>>>>')) {
				if (currentHunk) {
					currentHunk.endLine = i;
					hunks.push(currentHunk as ConflictHunk);
					currentHunk = null;
				}
			} else if (currentHunk) {
				if (section === 'ours') {
					currentHunk.ours?.push(line);
				} else {
					currentHunk.theirs?.push(line);
				}
			}
		}

		return hunks;
	};

	// Get file content with conflicts
	const { data: fileData, isLoading } = trpc.git.readFile.useQuery(
		{ repo: activeRepo ?? '', path: filePath },
		{ enabled: !!activeRepo && open && !!filePath }
	);

	const conflicts = useMemo(() => {
		if (!fileData?.content) return [];
		return parseConflicts(fileData.content);
	}, [fileData?.content]);

	const handleResolveHunk = (index: number, resolution: 'ours' | 'theirs' | 'both') => {
		setResolutions(prev => {
			const next = new Map(prev);
			next.set(index, resolution);
			return next;
		});
	};

	const handleResolveAll = (resolution: 'ours' | 'theirs') => {
		const newResolutions = new Map<number, 'ours' | 'theirs' | 'both' | 'manual'>();
		conflicts.forEach((_, index) => {
			newResolutions.set(index, resolution);
		});
		setResolutions(newResolutions);
	};

	const generateResolvedContent = (): string => {
		if (!fileData?.content) return '';

		const lines = fileData.content.split('\n');
		const result: string[] = [];
		let skipUntil = -1;

		for (let i = 0; i < lines.length; i++) {
			if (i < skipUntil) continue;

			const conflictIndex = conflicts.findIndex(c => c.startLine === i);
				if (conflictIndex >= 0) {
				const conflict = conflicts[conflictIndex];
				if (!conflict) {
					continue;
				}
				const resolution = resolutions.get(conflictIndex);

				if (resolution === 'ours') {
					result.push(...conflict.ours);
				} else if (resolution === 'theirs') {
					result.push(...conflict.theirs);
				} else if (resolution === 'both') {
					result.push(...conflict.ours, ...conflict.theirs);
				} else {
					// Not resolved, keep conflict markers
					result.push('<<<<<<< OURS');
					result.push(...conflict.ours);
					result.push('=======');
					result.push(...conflict.theirs);
					result.push('>>>>>>> THEIRS');
				}

				skipUntil = conflict.endLine + 1;
				} else {
					result.push(lines[i] ?? '');
				}
			}

		return result.join('\n');
	};

	const handleSave = async () => {
		// Check all conflicts are resolved
		const unresolvedCount = conflicts.filter((_, i) => !resolutions.has(i)).length;
		if (unresolvedCount > 0) {
			toast.error(`${String(unresolvedCount)} conflict(s) not resolved`);
			return;
		}

		setIsSaving(true);
		const resolvedContent = generateResolvedContent();

			try {
				// Write resolved file
				await writeFileMutation.mutateAsync({
					repo: activeRepo ?? '',
					path: filePath,
					content: resolvedContent,
				});

				// Stage the file
				await stageMutation.mutateAsync({
					repo: activeRepo ?? '',
					files: [filePath],
				});

			toast.success('Conflict resolved and staged');
			onResolved?.();
			onOpenChange(false);
		} catch {
			toast.error('Failed to save resolution');
		} finally {
			setIsSaving(false);
		}
	};

	const resolvedCount = resolutions.size;
	const totalConflicts = conflicts.length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GitMerge className="h-5 w-5" />
						Resolve Conflicts
						{totalConflicts > 0 && (
							<span className="text-sm font-normal text-muted-foreground">
								({resolvedCount}/{totalConflicts} resolved)
							</span>
						)}
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center justify-between py-2 border-b">
					<span className="text-sm text-muted-foreground truncate">
						{filePath}
					</span>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => { handleResolveAll('ours'); }}
						>
							<ArrowLeft className="h-4 w-4 mr-1" />
							Accept All Ours
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => { handleResolveAll('theirs'); }}
						>
							Accept All Theirs
							<ArrowRight className="h-4 w-4 ml-1" />
						</Button>
					</div>
				</div>

				<ScrollArea className="flex-1">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : conflicts.length === 0 ? (
						<div className="text-center py-8">
							<Check className="h-12 w-12 mx-auto mb-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]" />
							<p className="text-muted-foreground">No conflicts found</p>
						</div>
					) : (
						<div className="space-y-4 p-4">
							{conflicts.map((conflict, index) => {
								const resolution = resolutions.get(index);
								const isResolved = resolution !== undefined;

								return (
									<div
										key={index}
										className={`border rounded-lg overflow-hidden ${
											isResolved ? 'border-[color-mix(in_oklch,var(--success)_35%,transparent)]' : 'border-[color-mix(in_oklch,var(--warning)_35%,transparent)]'
										}`}
									>
										<div className="flex items-center justify-between px-3 py-2 bg-muted/50">
											<span className="text-sm font-medium">
												Conflict {index + 1}
												{isResolved && (
													<span className="text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] ml-2">
														({resolution})
													</span>
												)}
											</span>
											<div className="flex items-center gap-2">
												<Button
													variant={resolution === 'ours' ? 'default' : 'outline'}
													size="sm"
													onClick={() => { handleResolveHunk(index, 'ours'); }}
												>
													<ArrowLeft className="h-3 w-3 mr-1" />
													Ours
												</Button>
												<Button
													variant={resolution === 'both' ? 'default' : 'outline'}
													size="sm"
													onClick={() => { handleResolveHunk(index, 'both'); }}
												>
													Both
												</Button>
												<Button
													variant={resolution === 'theirs' ? 'default' : 'outline'}
													size="sm"
													onClick={() => { handleResolveHunk(index, 'theirs'); }}
												>
													Theirs
													<ArrowRight className="h-3 w-3 ml-1" />
												</Button>
											</div>
										</div>

										<div className="grid grid-cols-2 divide-x">
											{/* Our changes */}
											<div className="bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_30%,transparent)]">
												<div className="px-3 py-1 text-xs font-medium text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))] bg-[color-mix(in_oklch,var(--success)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--success)_50%,transparent)]">
													Current Change (Ours)
												</div>
												<div className="p-2 font-mono text-xs">
													{conflict.ours.map((line, i) => (
														<div key={i} className="whitespace-pre">
															{line || ' '}
														</div>
													))}
												</div>
											</div>

											{/* Their changes */}
											<div className="bg-[color-mix(in_oklch,var(--info)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--info)_30%,transparent)]">
												<div className="px-3 py-1 text-xs font-medium text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))] bg-[color-mix(in_oklch,var(--info)_15%,transparent)] dark:bg-[color-mix(in_oklch,var(--info)_50%,transparent)]">
													Incoming Change (Theirs)
												</div>
												<div className="p-2 font-mono text-xs">
													{conflict.theirs.map((line, i) => (
														<div key={i} className="whitespace-pre">
															{line || ' '}
														</div>
													))}
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</ScrollArea>

				<div className="flex items-center justify-between pt-4 border-t">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<AlertTriangle className="h-4 w-4" />
						<span>
							{totalConflicts - resolvedCount} unresolved conflict(s)
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" onClick={() => { onOpenChange(false); }}>
							Cancel
						</Button>
						<Button
							onClick={() => { void handleSave(); }}
							disabled={isSaving || resolvedCount < totalConflicts}
						>
							{isSaving ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Check className="h-4 w-4 mr-2" />
							)}
							Save Resolution
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default ThreeWayMergeEditor;
