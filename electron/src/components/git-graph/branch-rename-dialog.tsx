/**
 * Branch Rename Dialog
 */

import { ArrowRight, GitBranch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface BranchRenameDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	branchName: string;
	onRename: (oldName: string, newName: string, force?: boolean) => void;
}

// Roughly mirrors `git check-ref-format` rules for the sub-name. We surface
// these inline so the user understands *why* the rename button is disabled.
function validateBranchName(name: string): { ok: boolean; reason?: string } {
	const trimmed = name.trim();
	if (trimmed.length === 0) return { ok: false, reason: 'Name can’t be empty.' };
	if (/\s/.test(trimmed)) return { ok: false, reason: 'No spaces allowed.' };
	if (trimmed.startsWith('.') || trimmed.startsWith('-') || trimmed.startsWith('/')) {
		return { ok: false, reason: 'Can’t start with “.”, “-” or “/”.' };
	}
	if (trimmed.endsWith('.') || trimmed.endsWith('/') || trimmed.endsWith('.lock')) {
		return { ok: false, reason: 'Can’t end with “.”, “/” or “.lock”.' };
	}
	if (/[~^:?*\[\\]/.test(trimmed) || trimmed.includes('..') || trimmed.includes('@{')) {
		return { ok: false, reason: 'Contains an illegal character.' };
	}
	return { ok: true };
}

export function BranchRenameDialog({
	open,
	onOpenChange,
	branchName,
	onRename,
}: BranchRenameDialogProps) {
	const [newName, setNewName] = useState('');
	const [force, setForce] = useState(false);

	useEffect(() => {
		if (!open) {
			setNewName('');
			setForce(false);
			return;
		}
		setNewName(branchName);
		setForce(false);
	}, [branchName, open]);

	const validation = useMemo(() => validateBranchName(newName), [newName]);
	const trimmed = newName.trim();
	const unchanged = trimmed === branchName.trim();
	const canRename = validation.ok && !unchanged;

	const handleRename = () => {
		if (canRename) {
			onRename(branchName, trimmed, force);
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-md gap-0 overflow-hidden p-0'>
				<DialogHeader className='space-y-1 border-b border-border/60 px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className='grid h-7 w-7 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
							<GitBranch className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='font-semibold'>Rename branch</span>
					</DialogTitle>
					<DialogDescription className='text-[11px] text-muted-foreground/85'>
						The branch keeps its commits. Anything tracking the old name will need to retarget.
					</DialogDescription>
				</DialogHeader>

				<div className='space-y-3 px-5 py-4'>
					{/* Old → new preview */}
					<div className='flex items-center gap-2 rounded-lg border border-border/60 bg-muted/15 p-2 font-mono text-[11px] tabular-nums'>
						<span className='inline-flex max-w-[40%] truncate rounded-md border border-border/70 bg-card/70 px-1.5 py-0.5 text-foreground/80 line-through decoration-muted-foreground/60'>
							{branchName}
						</span>
						<ArrowRight className='h-3 w-3 shrink-0 text-muted-foreground/70' aria-hidden />
						<span
							className={cn(
								'inline-flex flex-1 truncate rounded-md border px-1.5 py-0.5',
								validation.ok
									? 'border-primary/40 bg-primary/8 text-primary'
									: 'border-destructive/40 bg-destructive/8 text-destructive',
							)}>
							{trimmed || <span className='text-muted-foreground/70'>(empty)</span>}
						</span>
					</div>

					<div className='space-y-1.5'>
						<Label
							htmlFor='new-name'
							className='text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
							New name
						</Label>
						<Input
							id='new-name'
							value={newName}
							onChange={(e) => { setNewName(e.target.value); }}
							placeholder='Enter new branch name…'
							autoFocus
							onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
							aria-invalid={!validation.ok}
							className={cn(
								'font-mono',
								!validation.ok && 'border-destructive/60 ring-1 ring-destructive/30 focus-visible:ring-destructive/40',
							)}
						/>
						<p className='min-h-4 text-[11px] leading-relaxed'>
							{!validation.ok ? (
								<span className='text-destructive'>{validation.reason}</span>
							) : unchanged ? (
								<span className='text-muted-foreground/85'>Name is unchanged.</span>
							) : (
								<span className='text-muted-foreground/85'>Looks good.</span>
							)}
						</p>
					</div>

					<label
						htmlFor='force-rename'
						className='flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-card/60 p-2.5 transition-colors hover:bg-card/80'>
						<input
							type='checkbox'
							id='force-rename'
							checked={force}
							onChange={(e) => { setForce(e.target.checked); }}
							className='mt-0.5 h-3.5 w-3.5 rounded accent-primary'
						/>
						<span className='leading-tight'>
							<span className='text-[12px] font-medium'>Force rename</span>
							<span className='block text-[11px] text-muted-foreground/85'>
								Reset the destination branch even if it already exists.
							</span>
						</span>
					</label>
				</div>

				<footer className='flex items-center justify-end gap-2 border-t border-border/60 bg-muted/15 px-5 py-3'>
					<Button variant='outline' size='sm' onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button size='sm' onClick={handleRename} disabled={!canRename}>
						Rename
					</Button>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
