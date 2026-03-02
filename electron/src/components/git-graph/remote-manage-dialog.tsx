/**
 * Remote Management Dialog
 * Add/remove/edit git remotes
 */

import {
	Globe,
	Plus,
	Trash2,
	Edit2,
	RefreshCw,
	GitPullRequest,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGitOperations } from '@/hooks/useGitOperations';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

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
	const [fetchRefspecInput, setFetchRefspecInput] = useState('');
	const [pushRefspecInput, setPushRefspecInput] = useState('');

	const { data: remotesData, refetch } = trpc.git.remotes.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);
	const { data: refspecData, isFetching: refspecLoading } = trpc.git.remote.refspec.useQuery(
		{ repo: activeRepo ?? '', name: editRemote?.name ?? '' },
		{ enabled: !!activeRepo && !!editRemote && addOpen }
	);
	const setRefspecMutation = trpc.git.remote.setRefspec.useMutation();

	const remotes: Remote[] = remotesData?.remotes ?? [];

	useEffect(() => {
		if (!editRemote) return;
		const fetchList = refspecData?.fetch ?? [];
		const pushList = refspecData?.push ?? [];
		setFetchRefspecInput(fetchList.join('\n'));
		setPushRefspecInput(pushList.join('\n'));
	}, [editRemote, refspecData]);

	const parseRefspecList = (value: string): string[] =>
		value
			.split(/\r?\n|,/)
			.map((entry) => entry.trim())
			.filter(Boolean);

	const resetEditorState = () => {
		setAddOpen(false);
		setEditRemote(null);
		setForm({ name: '', url: '', pushUrl: '' });
		setFetchRefspecInput('');
		setPushRefspecInput('');
	};

	const handleSaveRemote = async () => {
		if (!form.name || !form.url) return;

		const remoteResult = editRemote
			? await gitOps.remoteUpdate(form.name, form.url, form.pushUrl || undefined)
			: await gitOps.remoteAdd(form.name, form.url, form.pushUrl || undefined);

		const remoteError =
			remoteResult && typeof remoteResult === 'object' && 'error' in remoteResult
				? (remoteResult as { error?: string | null }).error
				: null;
		if (remoteError) {
			return;
		}

		const fetchRefspecs = parseRefspecList(fetchRefspecInput);
		const pushRefspecs = parseRefspecList(pushRefspecInput);
		const shouldSetRefspec =
			fetchRefspecs.length > 0 ||
			pushRefspecs.length > 0 ||
			(editRemote !== null && (fetchRefspecInput.trim().length > 0 || pushRefspecInput.trim().length > 0));

		if (shouldSetRefspec && activeRepo) {
			const refspecResult = await setRefspecMutation.mutateAsync({
				repo: activeRepo,
				name: form.name,
				...(fetchRefspecs.length > 0 ? { fetch: fetchRefspecs } : {}),
				...(pushRefspecs.length > 0 ? { push: pushRefspecs } : {}),
			});

			if (refspecResult.error) {
				return;
			}
		}

		resetEditorState();
		refetch();
	};

	const handleRemove = async (name: string) => {
		await gitOps.remoteRemove(name);
		refetch();
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-md ui-surface">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Globe className="h-5 w-5" />
							Manage Remotes
						</DialogTitle>
					</DialogHeader>

					<div className="flex items-center justify-end mb-2">
						<Button size="sm" onClick={() => { setAddOpen(true); }}>
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
												title={`Fetch ${remote.name}`}
											>
												<RefreshCw className="h-3.5 w-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 w-7 p-0"
												onClick={() => gitOps.fetch(remote.name, true)}
												title={`Fetch + prune ${remote.name}`}
											>
												<GitPullRequest className="h-3.5 w-3.5" />
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
													setFetchRefspecInput('');
													setPushRefspecInput('');
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

					<DialogFooter className="ui-toolbar">
						<Button variant="outline" onClick={() => { onOpenChange(false); }}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Add/Edit Remote Dialog */}
			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent className="ui-surface">
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
								onChange={(e) => { setForm({ ...form, name: e.target.value }); }}
								disabled={!!editRemote}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">URL</label>
							<Input
								placeholder="https://github.com/user/repo.git"
								value={form.url}
								onChange={(e) => { setForm({ ...form, url: e.target.value }); }}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Push URL (optional)</label>
							<Input
								placeholder="git@github.com:user/repo.git"
								value={form.pushUrl}
								onChange={(e) => { setForm({ ...form, pushUrl: e.target.value }); }}
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Fetch refspecs (advanced, one per line)</label>
							<textarea
								className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-xs font-mono"
								placeholder="+refs/heads/*:refs/remotes/origin/*"
								value={fetchRefspecInput}
								onChange={(e) => { setFetchRefspecInput(e.target.value); }}
							/>
							{refspecLoading && editRemote ? (
								<p className="text-muted-foreground text-[11px]">Loading current fetch refspecs...</p>
							) : (
								<p className="text-muted-foreground text-[11px]">
									Leave blank to keep Git defaults for this remote.
								</p>
							)}
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Push refspecs (advanced, one per line)</label>
							<textarea
								className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 text-xs font-mono"
								placeholder="refs/heads/main:refs/heads/main"
								value={pushRefspecInput}
								onChange={(e) => { setPushRefspecInput(e.target.value); }}
							/>
						</div>
					</div>
					<DialogFooter className="ui-toolbar">
						<Button variant="outline" onClick={() => {
							resetEditorState();
						}}>
							Cancel
						</Button>
						<Button
							onClick={handleSaveRemote}
							disabled={!form.name || !form.url || setRefspecMutation.isPending}
						>
							{editRemote ? 'Save' : 'Add'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
