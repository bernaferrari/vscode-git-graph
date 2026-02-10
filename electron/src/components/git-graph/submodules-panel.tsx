/**
 * Submodules Panel
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

interface SubmodulesPanelProps {
	repo: string;
}

export function SubmodulesPanel({ repo }: SubmodulesPanelProps) {
	const utils = trpc.useUtils();
	const { data: submodules } = trpc.git.submodule.list.useQuery({ repo }, { enabled: !!repo });

	const addMutation = trpc.git.submodule.add.useMutation({
		onSuccess: () => utils.git.submodule.list.invalidate(),
	});

	const updateMutation = trpc.git.submodule.update.useMutation();
	const removeMutation = trpc.git.submodule.remove.useMutation({
		onSuccess: () => utils.git.submodule.list.invalidate(),
	});

	const [url, setUrl] = useState('');
	const [path, setPath] = useState('');

	const handleAdd = () => {
		if (url.trim() && path.trim()) {
			addMutation.mutate({ repo, url: url, path: path });
			setUrl('');
			setPath('');
		}
	};

	const handleUpdate = (submodulePath: string, init?: boolean) => {
		updateMutation.mutate({ repo, path: submodulePath, init });
	};

	const handleRemove = (submodulePath: string) => {
		removeMutation.mutate({ repo, path: submodulePath });
	};

	// Map tRPC submodules to local Submodule type
	const rawSubmodules = submodules?.submodules ?? [];
	const submoduleList = rawSubmodules
		.filter((s): s is NonNullable<typeof s> => s !== null)
		.map((s) => ({
			path: s.path ?? '',
			branch: s.branch as string | undefined,
			currentCommit: s.currentCommit as string | undefined,
			status: (s.status as 'clean' | 'modified' | 'uninitialized') ?? 'clean',
		}));

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center justify-between">
					<span>Submodules</span>
					<Badge variant="secondary">{submoduleList.length}</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Add submodule */}
				<div className="space-y-2">
					<Input
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="Repository URL..."
						className="h-8"
					/>
					<div className="flex gap-2">
						<Input
							value={path}
							onChange={(e) => setPath(e.target.value)}
							placeholder="Local path..."
							className="h-8 flex-1"
						/>
						<Button size="sm" onClick={handleAdd} disabled={!url || !path}>
							Add
						</Button>
					</div>
				</div>

				{/* Submodule list */}
				<ScrollArea className="h-48">
					<div className="space-y-1">
						{submoduleList.map((sub) => (
							<div
								key={sub.path}
								className="flex items-center justify-between p-2 rounded hover:bg-accent text-sm"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium truncate">{sub.path}</span>
										<Badge
											variant={
												sub.status === 'clean' ? 'secondary' :
												sub.status === 'modified' ? 'default' : 'destructive'
											}
											className="text-xs"
										>
											{sub.status}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground truncate">{sub.currentCommit?.slice(0, 7) ?? ''}</p>
								</div>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={<Button variant="ghost" size="sm" className="h-6 px-2">Actions</Button>}
									/>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => handleUpdate(sub.path)}>
											Update
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleUpdate(sub.path, true)}>
											Initialize & Update
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => handleRemove(sub.path)}
											className="text-destructive"
										>
											Remove
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						))}
						{submoduleList.length === 0 && (
							<div className="text-center text-muted-foreground text-sm py-4">
								No submodules
							</div>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
