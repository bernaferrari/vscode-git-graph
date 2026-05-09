/**
 * Commit Context Menu
 * Right-click menu for commit actions
 */

import {
	ArrowLeft,
	ArrowRightLeft,
	Copy,
	GitBranch,
	GitMerge,
	History,
	RotateCcw,
	Scissors,
	Sparkles,
	Tag,
} from 'lucide-react';

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useOutcomePicker } from '@/components/outcome-preview/useOutcomePicker';
import { useGitOperations } from '@/hooks/useGitOperations';

interface CommitContextMenuProps {
	children: React.ReactNode;
	commit: {
		hash: string;
		message: string;
		author: string;
	};
	currentBranch?: string | null;
	onCreateBranch: () => void;
	onCreateTag: () => void;
	onMerge: () => void;
	onRebase: () => void;
	onCherryPick: () => void;
	onRevert: () => void;
}

export function CommitContextMenu({
	children,
	commit,
	currentBranch,
	onCreateBranch,
	onCreateTag,
	onMerge,
	onRebase,
	onCherryPick,
	onRevert,
}: CommitContextMenuProps) {
	const gitOps = useGitOperations();
	const { openIntegration } = useOutcomePicker();

	const handleCopyHash = () => { void gitOps.copyToClipboard(commit.hash); };
	const handleCopyMessage = () => { void gitOps.copyToClipboard(commit.message); };
	const handleResetHere = (mode: 'soft' | 'mixed' | 'hard') => { void gitOps.reset(commit.hash, mode); };
	const handleCheckout = () => { void gitOps.checkout(commit.hash); };

	const subject = commit.message.split('\n')[0] ?? '';

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent className='w-64'>
				{/* Header */}
				<ContextMenuLabel className='flex flex-col gap-0.5 py-1.5'>
					<span className='font-mono text-[10px] tabular-nums text-muted-foreground/85'>
						{commit.hash.slice(0, 8)}
					</span>
					<span className='line-clamp-1 text-[12px] font-semibold tracking-[-0.005em] text-foreground'>
						{subject}
					</span>
				</ContextMenuLabel>

				<ContextMenuSeparator />

				{/* Primary action */}
				{currentBranch ? (
					<ContextMenuItem
						onClick={() => {
							openIntegration({ source: commit.hash, target: currentBranch });
						}}
						className='gap-2'>
						<Sparkles className='h-3.5 w-3.5 text-primary' />
						Bring this in here…
					</ContextMenuItem>
				) : null}
				<ContextMenuItem onClick={handleCheckout} className='gap-2'>
					<ArrowLeft className='h-3.5 w-3.5 text-muted-foreground' />
					Check out commit
				</ContextMenuItem>

				<ContextMenuSeparator />

				{/* Create */}
				<ContextMenuItem onClick={onCreateBranch} className='gap-2'>
					<GitBranch className='h-3.5 w-3.5 text-muted-foreground' />
					Create branch…
				</ContextMenuItem>
				<ContextMenuItem onClick={onCreateTag} className='gap-2'>
					<Tag className='h-3.5 w-3.5 text-muted-foreground' />
					Create tag…
				</ContextMenuItem>

				<ContextMenuSeparator />

				{/* Integrate (advanced) */}
				<ContextMenuItem onClick={onMerge} className='gap-2'>
					<GitMerge className='h-3.5 w-3.5 text-muted-foreground' />
					Classic merge…
				</ContextMenuItem>
				<ContextMenuItem onClick={onRebase} className='gap-2'>
					<History className='h-3.5 w-3.5 text-muted-foreground' />
					Rebase onto here
				</ContextMenuItem>
				<ContextMenuItem onClick={onCherryPick} className='gap-2'>
					<Scissors className='h-3.5 w-3.5 text-muted-foreground' />
					Cherry-pick
				</ContextMenuItem>
				<ContextMenuItem onClick={onRevert} className='gap-2'>
					<ArrowRightLeft className='h-3.5 w-3.5 text-muted-foreground' />
					Revert commit
				</ContextMenuItem>

				<ContextMenuSeparator />

				{/* Reset submenu */}
				<ContextMenuSub>
					<ContextMenuSubTrigger className='gap-2'>
						<RotateCcw className='h-3.5 w-3.5 text-muted-foreground' />
						Reset to here
					</ContextMenuSubTrigger>
					<ContextMenuSubContent className='w-64'>
						<ResetItem
							label='Soft'
							hint='Keep changes staged'
							tone='warning'
							onClick={() => { handleResetHere('soft'); }}
						/>
						<ResetItem
							label='Mixed'
							hint='Keep changes unstaged'
							tone='info'
							onClick={() => { handleResetHere('mixed'); }}
						/>
						<ResetItem
							label='Hard'
							hint='Discard all changes'
							tone='destructive'
							onClick={() => { handleResetHere('hard'); }}
						/>
					</ContextMenuSubContent>
				</ContextMenuSub>

				<ContextMenuSeparator />

				{/* Copy */}
				<ContextMenuItem onClick={handleCopyHash} className='gap-2'>
					<Copy className='h-3.5 w-3.5 text-muted-foreground' />
					Copy SHA
					<span className='ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/70'>
						{commit.hash.slice(0, 7)}
					</span>
				</ContextMenuItem>
				<ContextMenuItem onClick={handleCopyMessage} className='gap-2'>
					<Copy className='h-3.5 w-3.5 text-muted-foreground' />
					Copy message
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

function ResetItem({
	label,
	hint,
	tone,
	onClick,
}: {
	label: string;
	hint: string;
	tone: 'warning' | 'info' | 'destructive';
	onClick: () => void;
}) {
	const toneClass =
		tone === 'warning'
			? 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'
			: tone === 'info'
				? 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]'
				: 'text-destructive';
	return (
		<ContextMenuItem onClick={onClick} className='gap-2'>
			<span className={`inline-block h-1.5 w-1.5 rounded-full ${toneClass} bg-current`} aria-hidden />
			<span className={`font-semibold ${toneClass}`}>{label}</span>
			<span className='ml-auto text-[10px] text-muted-foreground/85'>{hint}</span>
		</ContextMenuItem>
	);
}
