/**
 * Commit Signing Dialog
 * Wrapper around the production signing configuration surface.
 */

import { Key } from 'lucide-react';

import { SigningConfig } from './signing-config';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';

interface CommitSigningProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommitSigningDialog({ open, onOpenChange }: CommitSigningProps) {
	const { activeRepo } = useAppStore();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-lg ui-surface'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<Key className='h-5 w-5' />
						Commit Signing
					</DialogTitle>
				</DialogHeader>

				{activeRepo ? (
					<SigningConfig repo={activeRepo} />
				) : (
					<div className='text-sm text-muted-foreground'>Select a repository to configure commit signing.</div>
				)}

				<div className='flex justify-end'>
					<Button variant='outline' onClick={() => { onOpenChange(false); }}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
