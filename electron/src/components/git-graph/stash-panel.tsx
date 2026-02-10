/**
 * Stash Management UI
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StashPanelProps {
	repo: string;
}

export function StashPanel({ repo }: StashPanelProps) {
	const utils = trpc.useUtils();
	const { data: stashes } = trpc.git.stash.list.useQuery({ repo }, { enabled: !!repo });

	const pushMutation = trpc.git.stash.push.useMutation({
		onSuccess: () => utils.git.stash.list.invalidate(),
	});

	const popMutation = trpc.git.stash.pop.useMutation({
		onSuccess: () => utils.git.stash.list.invalidate(),
	});

	const applyMutation = trpc.git.stash.applyStash.useMutation({
		onSuccess: () => utils.git.stash.list.invalidate(),
	});

	const dropMutation = trpc.git.stash.drop.useMutation({
		onSuccess: () => utils.git.stash.list.invalidate(),
	});

	const [message, setMessage] = useState('');
	const [includeUntracked, setIncludeUntracked] = useState(true);

	const handleStash = () => {
		pushMutation.mutate({ repo, message: message || undefined, includeUntracked });
		setMessage('');
	};

	const handleApply = (selector: string, pop: boolean) => {
		if (pop) {
			popMutation.mutate({ repo, selector });
		} else {
			applyMutation.mutate({ repo, selector });
		}
	};

	const handleDrop = (selector: string) => {
		dropMutation.mutate({ repo, selector });
	};

	// Map tRPC stash objects to local StashEntry
	const stashList = (stashes?.stashes ?? []).map((s: { selector: string; message: string; date: number }) => ({
		selector: s.selector,
		message: s.message,
		branchName: undefined as string | undefined,
		date: s.date,
	}));

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center justify-between">
					<span>Stashes</span>
					<Badge variant="secondary">{stashList.length}</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Create stash */}
				<div className="space-y-2">
					<div className="flex gap-2">
						<Input
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="Stash message (optional)..."
							className="h-8"
						/>
						<Button size="sm" onClick={handleStash} disabled={pushMutation.isPending}>
							Stash
						</Button>
					</div>
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="include-untracked"
							checked={includeUntracked}
							onChange={(e) => setIncludeUntracked(e.target.checked)}
							className="h-3 w-3"
						/>
						<Label htmlFor="include-untracked" className="text-xs cursor-pointer">
							Include untracked files
						</Label>
					</div>
				</div>

				{/* Stash list */}
				<ScrollArea className="h-48">
					<div className="space-y-1">
						{stashList.map((stash) => (
							<div
								key={stash.selector}
								className="flex items-center justify-between p-2 rounded hover:bg-accent text-sm"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-mono text-xs text-muted-foreground">
											{stash.selector}
										</span>
										{stash.branchName && (
											<Badge variant="outline" className="text-xs">
												{stash.branchName}
											</Badge>
										)}
									</div>
									<p className="truncate text-xs">{stash.message}</p>
								</div>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button variant="ghost" size="sm" className="h-6 px-2">
												Actions
											</Button>
										}
									/>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => handleApply(stash.selector, false)}>
											Apply
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => handleApply(stash.selector, true)}>
											Pop
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => handleDrop(stash.selector)}
											className="text-destructive"
										>
											Drop
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						))}
						{stashList.length === 0 && (
							<div className="text-center text-muted-foreground text-sm py-4">
								No stashes
							</div>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
