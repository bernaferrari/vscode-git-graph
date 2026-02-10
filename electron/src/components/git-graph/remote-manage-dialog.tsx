/**
 * Remote Management Dialog
 * Add/remove/edit git remotes
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	Globe,
	Plus,
	Trash2,
	Edit2,
	RefreshCw,
} from 'lucide-react';
import { useGitOperations } from '@/hooks/useGitOperations';

interface RemoteManageDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface Remote {
	name: string;
	url: string;
	pushUrl?: string;
}

export function RemoteManageDialog({ open, onOpenChange }: RemoteManageDialogProps) {
	const { activeRepo } = useAppStore();
	const gitOps = useGitOperations();
	const [addOpen, setAddOpen] = useState(false);
	const [editRemote, setEditRemote] = useState<Remote | null>(null);
	const [form, setForm] = useState({ name: '', url: '', pushUrl: '' });

	const { data: remotesData, refetch } = trpc.git.remotes.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const remotes: Remote[] = remotesData?.remotes ?? [];

	const handleAdd = async () => {
		if (!form.name || !form.url) return;
		await gitOps.remoteAdd(form.name, form.url, form.pushUrl || undefined);
		setForm({ name: '', url: '', pushUrl: '' });
		setAddOpen(false);
		refetch();
	};

	const handleRemove = async (name: string) => {
		await gitOps.remoteRemove(name);
		refetch();
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Globe className="h-5 w-5" />
							Manage Remotes
						</DialogTitle>
					</DialogHeader>

					<div className="flex items-center justify-end mb-2">
						<Button size="sm" onClick={() => setAddOpen(true)}>
							<Plus className="h-4 w-4 mr-1" />
							Add Remote
						</Button>
					</div>

					<ScrollArea className="max-h-80">
						{remotes.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground text-sm">
								No remotes configured
							</div>
						) : (
							<div className="space-y-2">
								{remotes.map((remote) => (
									<div
										key={remote.name}
										className="flex items-center gap-3 p-3 rounded-lg border"
									>
										<Globe className="h-4 w-4 text-muted-foreground shrink-0" />
										<div className="flex-1 min-w-0">
											<div className="font-medium text-sm">{remote.name}</div>
											<div className="text-xs text-muted-foreground truncate">
												{remote.url}
											</div>
											{remote.pushUrl && remote.pushUrl !== remote.url && (
												<div className="text-xs text-muted-foreground truncate">
													Push: {remote.pushUrl}
												</div>
											)}
										</div>
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0"
												onClick={() => gitOps.fetch(remote.name)}
											>
												<RefreshCw className="h-3.5 w-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0"
												onClick={() => {
													setEditRemote(remote);
													setForm({
														name: remote.name,
														url: remote.url,
														pushUrl: remote.pushUrl ?? '',
													});
													setAddOpen(true);
												}}
											>
												<Edit2 className="h-3.5 w-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0 text-destructive hover:text-destructive"
												onClick={() => handleRemove(remote.name)}
												disabled={remote.name === 'origin'}
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</ScrollArea>

					<DialogFooter>
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add/Edit Remote Dialog */}
			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editRemote ? 'Edit Remote' : 'Add Remote'}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Name</label>
							<Input
								placeholder="origin"
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								disabled={!!editRemote}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">URL</label>
							<Input
								placeholder="https://github.com/user/repo.git"
								value={form.url}
								onChange={(e) => setForm({ ...form, url: e.target.value })}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Push URL (optional)</label>
							<Input
								placeholder="git@github.com:user/repo.git"
								value={form.pushUrl}
								onChange={(e) => setForm({ ...form, pushUrl: e.target.value })}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => {
							setAddOpen(false);
							setEditRemote(null);
							setForm({ name: '', url: '', pushUrl: '' });
						}}>
							Cancel
						</Button>
						<Button onClick={handleAdd} disabled={!form.name || !form.url}>
							{editRemote ? 'Save' : 'Add'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
