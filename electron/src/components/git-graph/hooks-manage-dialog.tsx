/**
 * Hooks Management Panel
 * View and toggle git hooks
 */

import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Switch,
} from '@/components/ui/switch';
import {
	Settings,
	FileCode,
	Info,
} from 'lucide-react';

interface HooksManageDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface GitHookInfo {
	name: string;
	enabled: boolean;
}

export function HooksManageDialog({ open, onOpenChange }: HooksManageDialogProps) {
	const { activeRepo } = useAppStore();

	const { data: hooksData, refetch } = trpc.git.hooks.list.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const toggleMutation = trpc.git.hooks.toggle.useMutation({
		onSuccess: () => refetch(),
	});

	const hooks: GitHookInfo[] = hooksData?.hooks ?? [];

	const HOOK_DESCRIPTIONS: Record<string, string> = {
		'pre-commit': 'Run before committing. Use to validate code.',
		'prepare-commit-msg': 'Run before commit message editor opens.',
		'commit-msg': 'Run to validate commit message.',
		'post-commit': 'Run after commit is created.',
		'pre-push': 'Run before pushing to remote.',
		'pre-rebase': 'Run before rebasing.',
		'post-merge': 'Run after merge completes.',
		'pre-receive': 'Run on remote when receiving pushes.',
		'update': 'Run on remote for each ref being updated.',
		'post-receive': 'Run on remote after receiving pushes.',
		'post-update': 'Run on remote after refs are updated.',
		'push-to-checkout': 'Run on remote before checkout.',
		'pre-auto-gc': 'Run before auto garbage collection.',
		'post-rewrite': 'Run after commit rewriting (rebase, amend).',
		'sendemail-validate': 'Run before sending email patches.',
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Git Hooks
					</DialogTitle>
				</DialogHeader>

				<ScrollArea className="max-h-80">
					{hooks.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground text-sm">
							No hooks found in repository
						</div>
					) : (
						<div className="space-y-2 py-2">
							{hooks.map((hook: GitHookInfo) => (
								<div
									key={hook.name}
									className="flex items-start gap-3 p-3 rounded-lg border"
								>
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
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<FileCode className="h-4 w-4 text-muted-foreground" />
											<span className="font-medium text-sm">{hook.name}</span>
											{hook.enabled && (
												<span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
													enabled
												</span>
											)}
										</div>
										<p className="text-xs text-muted-foreground mt-1">
											{HOOK_DESCRIPTIONS[hook.name] ?? 'Custom hook'}
										</p>
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>

				<div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
					<Info className="h-3.5 w-3.5" />
					<span>Hooks are scripts that run at specific git events</span>
				</div>

				<div className="flex justify-end pt-2">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
