/**
 * Hooks Management Panel
 * View and toggle git hooks
 */

import { FileCode, Info, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';

interface HooksManageDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface GitHookInfo {
	name: string;
	enabled: boolean;
}

const HOOK_DESCRIPTIONS: Record<string, string> = {
	'pre-commit': 'Runs before a commit is recorded. Good for linting and quick checks.',
	'prepare-commit-msg': 'Runs before the commit message editor opens.',
	'commit-msg': 'Runs to validate or rewrite the commit message.',
	'post-commit': 'Runs right after a commit is created.',
	'pre-push': 'Runs before pushing to a remote.',
	'pre-rebase': 'Runs before a rebase begins.',
	'post-merge': 'Runs after a merge completes.',
	'pre-receive': 'Runs on the remote when push is received.',
	update: 'Runs on the remote for each ref being updated.',
	'post-receive': 'Runs on the remote after push is received.',
	'post-update': 'Runs on the remote after refs are updated.',
	'push-to-checkout': 'Runs on the remote before checking out the pushed branch.',
	'pre-auto-gc': 'Runs before automatic garbage collection.',
	'post-rewrite': 'Runs after commits are rewritten (rebase, amend).',
	'sendemail-validate': 'Runs before sending email patches.',
};

export function HooksManageDialog({ open, onOpenChange }: HooksManageDialogProps) {
	const { activeRepo } = useAppStore();

	const { data: hooksData, refetch } = trpc.git.hooks.list.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open },
	);

	const toggleMutation = trpc.git.hooks.toggle.useMutation({
		onSuccess: () => refetch(),
	});

	const hooks: GitHookInfo[] = hooksData?.hooks ?? [];
	const enabledCount = hooks.filter((h) => h.enabled).length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-lg gap-0 overflow-hidden p-0'>
				<DialogHeader className='space-y-1 border-b border-border/60 px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className='grid h-7 w-7 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
							<Settings className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='font-semibold'>Git hooks</span>
						{hooks.length > 0 && (
							<span className='ml-1 rounded-full border border-border/70 bg-card/70 px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground/85'>
								{enabledCount}/{hooks.length} on
							</span>
						)}
					</DialogTitle>
					<DialogDescription className='text-[11px] text-muted-foreground/85'>
						Hooks are scripts Git runs at specific events. Toggle them off to skip without deleting.
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className='max-h-[28rem]'>
					{hooks.length === 0 ? (
						<div className='flex flex-col items-center justify-center px-4 py-12 text-center'>
							<span className='mb-3 grid h-10 w-10 place-items-center rounded-lg bg-muted/60 text-muted-foreground/85 ring-1 ring-border/50'>
								<FileCode className='h-4 w-4' />
							</span>
							<p className='text-[0.8125rem] font-semibold tracking-[-0.005em]'>No hooks installed</p>
							<p className='mt-0.5 max-w-[18rem] text-xs text-muted-foreground/85'>
								Drop a script into <span className='font-mono'>.git/hooks/</span> to register a hook here.
							</p>
						</div>
					) : (
						<ul className='divide-y divide-border/40'>
							{hooks.map((hook) => (
								<li key={hook.name} className='flex items-start gap-3 px-4 py-3'>
									<Switch
										checked={hook.enabled}
										onCheckedChange={(checked) => {
											toggleMutation.mutate({
												repo: activeRepo ?? '',
												name: hook.name,
												enabled: checked,
											});
										}}
									/>
									<div className='min-w-0 flex-1 leading-tight'>
										<div className='flex items-center gap-2'>
											<FileCode
												className={cn(
													'h-3.5 w-3.5',
													hook.enabled ? 'text-primary' : 'text-muted-foreground/70',
												)}
												aria-hidden
											/>
											<span className='font-mono text-[12px] font-semibold tabular-nums'>
												{hook.name}
											</span>
											{hook.enabled ? (
												<span className='inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklch,var(--success)_30%,transparent)] bg-[color-mix(in_oklch,var(--success)_10%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'>
													<span aria-hidden className='inline-block h-1 w-1 rounded-full bg-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />
													On
												</span>
											) : (
												<span className='inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
													Off
												</span>
											)}
										</div>
										<p className='mt-0.5 text-[11px] leading-relaxed text-muted-foreground/85'>
											{HOOK_DESCRIPTIONS[hook.name] ?? 'Custom hook script.'}
										</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</ScrollArea>

				<footer className='flex items-center justify-between gap-3 border-t border-border/60 bg-muted/15 px-5 py-3'>
					<p className='flex items-center gap-1.5 text-[11px] text-muted-foreground/85'>
						<Info className='h-3 w-3' />
						Toggling renames the file with a <span className='font-mono'>.disabled</span> suffix.
					</p>
					<Button variant='outline' size='sm' onClick={() => { onOpenChange(false); }}>
						Close
					</Button>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
