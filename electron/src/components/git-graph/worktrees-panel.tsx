/**
 * Worktrees Panel
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Worktree {
	path: string;
	branch: string;
	commit: string;
	isMain: boolean;
}

interface WorktreesPanelProps {
	repo: string;
}

export function WorktreesPanel({ repo }: WorktreesPanelProps) {
	const utils = trpc.useUtils();
	const { data: worktrees } = trpc.git.worktree.list.useQuery({ repo }, { enabled: !!repo });

	const addMutation = trpc.git.worktree.add.useMutation({
		onSuccess: () => utils.git.worktree.list.invalidate(),
	});

	const removeMutation = trpc.git.worktree.remove.useMutation({
		onSuccess: () => utils.git.worktree.list.invalidate(),
	});

	const pruneMutation = trpc.git.worktree.prune.useMutation();

	const [path, setPath] = useState('');
	const [branch, setBranch] = useState('');

	const handleAdd = () => {
		if (path.trim() && branch.trim()) {
			addMutation.mutate({ repo, path, branch });
			setPath('');
			setBranch('');
		}
	};

	const handleRemove = (worktreePath: string, force: boolean = false) => {
		removeMutation.mutate({ repo, path: worktreePath, force });
	};

	const handlePrune = () => {
		pruneMutation.mutate({ repo });
	};

	const worktreeList: Worktree[] = (worktrees?.worktrees ?? []).map((w: Record<string, unknown>) => ({
		path: (w.path as string) ?? '',
		branch: (w.branch as string) ?? '',
		commit: (w.commit as string) ?? '',
		isMain: (w.isMain as boolean) ?? false,
	}));

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center justify-between">
					<span>Worktrees</span>
					<Badge variant="secondary">{worktreeList.length}</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Add worktree */}
				<div className="space-y-2">
					<Input
						value={branch}
						onChange={(e) => setBranch(e.target.value)}
						placeholder="Branch name..."
						className="h-8"
					/>
					<div className="flex gap-2">
						<Input
							value={path}
							onChange={(e) => setPath(e.target.value)}
							placeholder="Directory path..."
							className="h-8 flex-1"
						/>
						<Button size="sm" onClick={handleAdd} disabled={!branch || !path}>
							Add
						</Button>
					</div>
				</div>

				{/* Worktree list */}
				<ScrollArea className="h-48">
					<div className="space-y-1">
						{worktreeList.map((wt) => (
							<div
								key={wt.path}
								className="flex items-center justify-between p-2 rounded hover:bg-accent text-sm"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium truncate">{wt.branch}</span>
										{wt.isMain && (
											<Badge variant="default" className="text-xs">
												Main
											</Badge>
										)}
									</div>
									<p className="text-xs text-muted-foreground truncate">{wt.path}</p>
								</div>
								{!wt.isMain && (
									<DropdownMenu>
										<DropdownMenuTrigger
											render={<Button variant="ghost" size="sm" className="h-6 px-2">Actions</Button>}
										/>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => handleRemove(wt.path)}>
												Remove
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => handleRemove(wt.path, true)}>
												Force Remove
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						))}
						{worktreeList.length === 0 && (
							<div className="text-center text-muted-foreground text-sm py-4">
								No worktrees
							</div>
						)}
					</div>
				</ScrollArea>

				<Button variant="outline" size="sm" onClick={handlePrune} className="w-full">
					Prune Stale Worktrees
				</Button>
			</CardContent>
		</Card>
	);
}
