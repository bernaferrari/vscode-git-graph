/**
 * Commit Signing Dialog
 * Wrapper around the production signing configuration surface.
 */

import { Key } from 'lucide-react';

import { SigningConfig } from './signing-config';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';

interface CommitSigningProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommitSigningDialog({ open, onOpenChange }: CommitSigningProps) {
	const { activeRepo } = useAppStore();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-lg gap-0 overflow-hidden p-0'>
				<DialogHeader className='space-y-1 border-b border-border/60 px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className='grid h-7 w-7 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
							<Key className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='font-semibold'>Commit signing</span>
					</DialogTitle>
					<DialogDescription className='text-[11px] text-muted-foreground/85'>
						Use GPG, SSH, or X.509 keys to cryptographically sign commits.
					</DialogDescription>
				</DialogHeader>

				<div className='px-5 py-4'>
					{activeRepo ? (
						<SigningConfig repo={activeRepo} />
					) : (
						<p className='text-[0.8125rem] text-muted-foreground'>
							Select a repository to configure commit signing.
						</p>
					)}
				</div>

				<footer className='flex items-center justify-end gap-2 border-t border-border/60 bg-muted/15 px-5 py-3'>
					<Button variant='outline' size='sm' onClick={() => { onOpenChange(false); }}>
						Close
					</Button>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
