/**
 * Git Graph Dialogs
 * Uses Shadcn alert-dialog and custom dialog components
 */

import { useState, type ReactNode } from 'react';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// ==================== Confirm Dialog ====================

interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: 'default' | 'destructive';
	onConfirm: () => void;
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = 'Continue',
	cancelLabel = 'Cancel',
	variant = 'default',
	onConfirm,
}: ConfirmDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description && (
						<AlertDialogDescription>{description}</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

// ==================== Base Dialog ====================

interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	width?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Dialog({
	open,
	onOpenChange,
	title,
	children,
	footer,
	width = 'md',
}: DialogProps) {
	const widthClasses = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
	};

	return open ? (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div
				className="fixed inset-0 bg-black/55"
				onClick={() => { onOpenChange(false); }}
			/>
			<Card className={`relative z-50 w-full ${widthClasses[width]} mx-4 ui-surface`}>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
				</CardHeader>
				<CardContent>{children}</CardContent>
				{footer && <CardFooter className="justify-end gap-2">{footer}</CardFooter>}
			</Card>
		</div>
	) : null;
}

// ==================== Create Branch Dialog ====================

interface CreateBranchDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (name: string, checkout: boolean) => void;
	targetCommit?: string;
	defaultCheckout?: boolean;
}

export function CreateBranchDialog({
	open,
	onOpenChange,
	onCreate,
	targetCommit: _targetCommit,
	defaultCheckout = false,
}: CreateBranchDialogProps) {
	const [name, setName] = useState('');
	const [checkout, setCheckout] = useState(defaultCheckout);

	const handleSubmit = () => {
		if (name.trim()) {
			onCreate(name.trim(), checkout);
			setName('');
			onOpenChange(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Create Branch"
			footer={
				<>
					<Button variant="outline" onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!name.trim()}>
						Create Branch
					</Button>
				</>
			}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="branch-name">Branch Name</Label>
					<Input
						id="branch-name"
						value={name}
						onChange={(e) => { setName(e.target.value); }}
						placeholder="Enter branch name..."
						autoFocus
						onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
					/>
				</div>
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="branch-checkout"
						checked={checkout}
						onChange={(e) => { setCheckout(e.target.checked); }}
						className="h-4 w-4"
					/>
					<Label htmlFor="branch-checkout" className="cursor-pointer">
						Checkout after creation
					</Label>
				</div>
			</div>
		</Dialog>
	);
}

// ==================== Add Tag Dialog ====================

interface AddTagDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAdd: (name: string, type: 'annotated' | 'lightweight', push: boolean) => void;
	targetCommit?: string;
	defaultType?: 'annotated' | 'lightweight';
	defaultPush?: boolean;
}

export function AddTagDialog({
	open,
	onOpenChange,
	onAdd,
	targetCommit: _targetCommit,
	defaultType = 'annotated',
	defaultPush = false,
}: AddTagDialogProps) {
	const [name, setName] = useState('');
	const [type, setType] = useState<'annotated' | 'lightweight'>(defaultType);
	const [push, setPush] = useState(defaultPush);

	const handleSubmit = () => {
		if (name.trim()) {
			onAdd(name.trim(), type, push);
			setName('');
			onOpenChange(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Add Tag"
			footer={
				<>
					<Button variant="outline" onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!name.trim()}>
						Add Tag
					</Button>
				</>
			}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="tag-name">Tag Name</Label>
					<Input
						id="tag-name"
						value={name}
						onChange={(e) => { setName(e.target.value); }}
						placeholder="Enter tag name..."
						autoFocus
						onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
					/>
				</div>
				<div className="space-y-2">
					<Label>Tag Type</Label>
					<Select value={type} onValueChange={(v) => { setType(v as 'annotated' | 'lightweight'); }}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="annotated">Annotated</SelectItem>
							<SelectItem value="lightweight">Lightweight</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="tag-push"
						checked={push}
						onChange={(e) => { setPush(e.target.checked); }}
						className="h-4 w-4"
					/>
					<Label htmlFor="tag-push" className="cursor-pointer">
						Push to remote
					</Label>
				</div>
			</div>
		</Dialog>
	);
}

// ==================== Reset Dialog ====================

interface ResetDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onReset: (mode: 'soft' | 'mixed' | 'hard') => void;
	targetCommit: string;
	defaultMode?: 'soft' | 'mixed' | 'hard';
}

export function ResetDialog({
	open,
	onOpenChange,
	onReset,
	targetCommit,
	defaultMode = 'mixed',
}: ResetDialogProps) {
	const [mode, setMode] = useState<'soft' | 'mixed' | 'hard'>(defaultMode);

	const handleSubmit = () => {
		onReset(mode);
		onOpenChange(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Reset to Commit"
			footer={
				<>
					<Button variant="outline" onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button
						variant={mode === 'hard' ? 'destructive' : 'default'}
						onClick={handleSubmit}
					>
						Reset
					</Button>
				</>
			}
		>
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Reset current branch to commit{' '}
					<Badge variant="secondary">{targetCommit.slice(0, 7)}</Badge>
				</p>
				<div className="space-y-2">
					<Label>Reset Mode</Label>
					<Select
						value={mode}
						onValueChange={(v) => { setMode(v as 'soft' | 'mixed' | 'hard'); }}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="soft">
								Soft - Keep all changes staged
							</SelectItem>
							<SelectItem value="mixed">
								Mixed - Keep changes but unstage
							</SelectItem>
							<SelectItem value="hard">
								Hard - Discard all changes
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
				{mode === 'hard' && (
					<p className="text-sm text-destructive">
						Warning: Hard reset will permanently discard all uncommitted changes!
					</p>
				)}
			</div>
		</Dialog>
	);
}

// ==================== Delete Branch Dialog ====================

interface DeleteBranchDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDelete: (force: boolean) => void;
	branchName: string;
	isMerged?: boolean;
}

export function DeleteBranchDialog({
	open,
	onOpenChange,
	onDelete,
	branchName,
	isMerged = true,
}: DeleteBranchDialogProps) {
	const [force, setForce] = useState(false);

	const handleDelete = () => {
		onDelete(force);
		setForce(false);
		onOpenChange(false);
	};

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Delete Branch"
			description={
				<div className="space-y-2">
					<p>
						Are you sure you want to delete branch{' '}
						<Badge variant="secondary">{branchName}</Badge>?
					</p>
					{!isMerged && (
						<div className="flex items-center gap-2 mt-4">
							<input
								type="checkbox"
								id="force-delete"
								checked={force}
								onChange={(e) => { setForce(e.target.checked); }}
								className="h-4 w-4"
							/>
							<Label htmlFor="force-delete" className="cursor-pointer text-sm">
								Force delete (branch is not merged)
							</Label>
						</div>
					)}
				</div>
			}
			confirmLabel="Delete"
			variant="destructive"
			onConfirm={handleDelete}
		/>
	);
}

// ==================== Merge Dialog ====================

interface MergeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onMerge: (options: { noFastForward: boolean; squash: boolean; noCommit: boolean }) => void;
	branchName: string;
	defaultNoFastForward?: boolean;
}

export function MergeDialog({
	open,
	onOpenChange,
	onMerge,
	branchName,
	defaultNoFastForward = true,
}: MergeDialogProps) {
	const [noFastForward, setNoFastForward] = useState(defaultNoFastForward);
	const [squash, setSquash] = useState(false);
	const [noCommit, setNoCommit] = useState(false);

	const handleMerge = () => {
		onMerge({ noFastForward, squash, noCommit });
		onOpenChange(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Merge Branch"
			footer={
				<>
					<Button variant="outline" onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button onClick={handleMerge}>Merge</Button>
				</>
			}
		>
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Merge <Badge variant="secondary">{branchName}</Badge> into current branch
				</p>
				<Separator />
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="no-ff"
							checked={noFastForward}
							onChange={(e) => { setNoFastForward(e.target.checked); }}
							className="h-4 w-4"
						/>
						<Label htmlFor="no-ff" className="cursor-pointer">
							No fast-forward (create merge commit)
						</Label>
					</div>
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="squash"
							checked={squash}
							onChange={(e) => { setSquash(e.target.checked); }}
							className="h-4 w-4"
						/>
						<Label htmlFor="squash" className="cursor-pointer">
							Squash commits
						</Label>
					</div>
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="no-commit"
							checked={noCommit}
							onChange={(e) => { setNoCommit(e.target.checked); }}
							className="h-4 w-4"
						/>
						<Label htmlFor="no-commit" className="cursor-pointer">
							No commit (stage changes only)
						</Label>
					</div>
				</div>
			</div>
		</Dialog>
	);
}

// ==================== Rebase Dialog ====================

interface RebaseDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRebase: (interactive: boolean) => void;
	onto: string;
}

export function RebaseDialog({
	open,
	onOpenChange,
	onRebase,
	onto,
}: RebaseDialogProps) {
	const [interactive, setInteractive] = useState(false);

	const handleRebase = () => {
		onRebase(interactive);
		setInteractive(false);
		onOpenChange(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Rebase"
			footer={
				<>
					<Button variant="outline" onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button onClick={handleRebase}>Rebase</Button>
				</>
			}
		>
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Rebase current branch onto <Badge variant="secondary">{onto.slice(0, 7)}</Badge>
				</p>
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="interactive"
						checked={interactive}
						onChange={(e) => { setInteractive(e.target.checked); }}
						className="h-4 w-4"
					/>
					<Label htmlFor="interactive" className="cursor-pointer">
						Interactive rebase
					</Label>
				</div>
			</div>
		</Dialog>
	);
}

// ==================== Cherry Pick Dialog ====================

interface CherryPickDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCherryPick: (noCommit: boolean) => void;
	commitHash: string;
	commitMessage?: string;
}

export function CherryPickDialog({
	open,
	onOpenChange,
	onCherryPick,
	commitHash,
	commitMessage,
}: CherryPickDialogProps) {
	const [noCommit, setNoCommit] = useState(false);

	const handleCherryPick = () => {
		onCherryPick(noCommit);
		setNoCommit(false);
		onOpenChange(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Cherry Pick"
			footer={
				<>
					<Button variant="outline" onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button onClick={handleCherryPick}>Cherry Pick</Button>
				</>
			}
		>
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Cherry pick commit <Badge variant="secondary">{commitHash.slice(0, 7)}</Badge>
				</p>
				{commitMessage && (
					<p className="text-sm bg-muted p-2 rounded">{commitMessage}</p>
				)}
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="no-commit-cp"
						checked={noCommit}
						onChange={(e) => { setNoCommit(e.target.checked); }}
						className="h-4 w-4"
					/>
					<Label htmlFor="no-commit-cp" className="cursor-pointer">
						No commit (stage changes only)
					</Label>
				</div>
			</div>
		</Dialog>
	);
}

// ==================== Revert Dialog ====================

interface RevertDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRevert: (noCommit: boolean) => void;
	commitHash: string;
	commitMessage?: string;
}

export function RevertDialog({
	open,
	onOpenChange,
	onRevert,
	commitHash,
	commitMessage,
}: RevertDialogProps) {
	const [noCommit, setNoCommit] = useState(false);

	const handleRevert = () => {
		onRevert(noCommit);
		setNoCommit(false);
		onOpenChange(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title="Revert Commit"
			footer={
				<>
					<Button variant="outline" onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button onClick={handleRevert}>Revert</Button>
				</>
			}
		>
			<div className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Revert commit <Badge variant="secondary">{commitHash.slice(0, 7)}</Badge>
				</p>
				{commitMessage && (
					<p className="text-sm bg-muted p-2 rounded">{commitMessage}</p>
				)}
				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="no-commit-rv"
						checked={noCommit}
						onChange={(e) => { setNoCommit(e.target.checked); }}
						className="h-4 w-4"
					/>
					<Label htmlFor="no-commit-rv" className="cursor-pointer">
						No commit (stage changes only)
					</Label>
				</div>
			</div>
		</Dialog>
	);
}
