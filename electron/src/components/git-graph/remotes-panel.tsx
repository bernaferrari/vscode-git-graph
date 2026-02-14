/**
 * Remote Management Panel
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
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Remote {
	name: string;
	url: string;
	pushUrl?: string;
}

interface RemotesPanelProps {
	repo: string;
}

export function RemotesPanel({ repo }: RemotesPanelProps) {
	const utils = trpc.useUtils();
	const { data: remotes } = trpc.git.remotes.useQuery({ repo }, { enabled: !!repo });

	const addMutation = trpc.git.remote.add.useMutation({
		onSuccess: () => {
			utils.git.remotes.invalidate();
			utils.git.repoInfo.invalidate();
			setShowAddDialog(false);
			setNewName('');
			setNewUrl('');
		},
	});

	const removeMutation = trpc.git.remote.remove.useMutation({
		onSuccess: () => {
			utils.git.remotes.invalidate();
			utils.git.repoInfo.invalidate();
			setDeleteConfirm(null);
		},
	});

	const updateMutation = trpc.git.remote.update.useMutation({
		onSuccess: () => {
			utils.git.remotes.invalidate();
			utils.git.repoInfo.invalidate();
			setEditingRemote(null);
		},
	});

	// Add dialog state
	const [showAddDialog, setShowAddDialog] = useState(false);
	const [newName, setNewName] = useState('');
	const [newUrl, setNewUrl] = useState('');
	const [newPushUrl, setNewPushUrl] = useState('');

	// Edit dialog state
	const [editingRemote, setEditingRemote] = useState<Remote | null>(null);
	const [editUrl, setEditUrl] = useState('');
	const [editPushUrl, setEditPushUrl] = useState('');

	// Delete confirmation
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	const remoteList = (remotes?.remotes ?? []).map((r) => ({
		name: r.name,
		url: r.url,
		...(r.pushUrl ? { pushUrl: r.pushUrl } : {}),
	}));

	const handleAdd = () => {
		if (newName.trim() && newUrl.trim()) {
			addMutation.mutate({
				repo,
				name: newName,
				url: newUrl,
				pushUrl: newPushUrl || undefined,
			});
		}
	};

	const handleEdit = (remote: Remote) => {
		setEditingRemote(remote);
		setEditUrl(remote.url);
		setEditPushUrl(remote.pushUrl ?? '');
	};

	const handleSaveEdit = () => {
		if (editingRemote) {
			updateMutation.mutate({
				repo,
				name: editingRemote.name,
				url: editUrl,
				pushUrl: editPushUrl || undefined,
			});
		}
	};

	const handleDelete = (name: string) => {
		removeMutation.mutate({ repo, name });
	};

	return (
		<>
			<Card className="h-full">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm flex items-center justify-between">
						<span>Remotes</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowAddDialog(true)}
						>
							Add Remote
						</Button>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-64">
						<div className="space-y-2">
							{remoteList.map((remote) => (
								<div
									key={remote.name}
									className="flex items-start justify-between p-3 rounded border"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-medium">{remote.name}</span>
											{remote.name === 'origin' && (
												<Badge variant="secondary" className="text-xs">default</Badge>
											)}
										</div>
										<div className="text-xs text-muted-foreground space-y-1">
											<p className="truncate">
												<span className="font-medium">Fetch:</span> {remote.url}
											</p>
											{remote.pushUrl && remote.pushUrl !== remote.url && (
												<p className="truncate">
													<span className="font-medium">Push:</span> {remote.pushUrl}
												</p>
											)}
										</div>
									</div>
									<div className="flex gap-1 ml-2">
										<Button
											variant="ghost"
											size="sm"
											className="h-7 px-2"
											onClick={() => handleEdit(remote)}
										>
											Edit
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 px-2 text-destructive"
											onClick={() => setDeleteConfirm(remote.name)}
										>
											Delete
										</Button>
									</div>
								</div>
							))}
							{remoteList.length === 0 && (
								<div className="text-center text-muted-foreground text-sm py-8">
									No remotes configured
								</div>
							)}
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Add Remote Dialog */}
			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent className="ui-surface">
					<DialogHeader>
						<DialogTitle>Add Remote</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Name</Label>
							<Input
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="e.g., upstream"
							/>
						</div>
						<div className="space-y-2">
							<Label>URL</Label>
							<Input
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
								placeholder="https://github.com/user/repo.git"
							/>
						</div>
						<div className="space-y-2">
							<Label>Push URL (optional)</Label>
							<Input
								value={newPushUrl}
								onChange={(e) => setNewPushUrl(e.target.value)}
								placeholder="Leave empty to use fetch URL"
							/>
						</div>
					</div>
					<DialogFooter className="ui-toolbar">
						<Button variant="outline" onClick={() => setShowAddDialog(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleAdd}
							disabled={!newName || !newUrl || addMutation.isPending}
						>
							Add Remote
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Remote Dialog */}
			<Dialog open={!!editingRemote} onOpenChange={() => setEditingRemote(null)}>
				<DialogContent className="ui-surface">
					<DialogHeader>
						<DialogTitle>Edit Remote: {editingRemote?.name}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>URL</Label>
							<Input
								value={editUrl}
								onChange={(e) => setEditUrl(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>Push URL (optional)</Label>
							<Input
								value={editPushUrl}
								onChange={(e) => setEditPushUrl(e.target.value)}
								placeholder="Leave empty to use fetch URL"
							/>
						</div>
					</div>
					<DialogFooter className="ui-toolbar">
						<Button variant="outline" onClick={() => setEditingRemote(null)}>
							Cancel
						</Button>
						<Button
							onClick={handleSaveEdit}
							disabled={!editUrl || updateMutation.isPending}
						>
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation */}
			<AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Remote</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete the remote "{deleteConfirm}"? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
