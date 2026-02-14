/**
 * Branch Rename Dialog
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface BranchRenameDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	branchName: string;
	onRename: (oldName: string, newName: string) => void;
}

export function BranchRenameDialog({
	open,
	onOpenChange,
	branchName,
	onRename,
}: BranchRenameDialogProps) {
	const [newName, setNewName] = useState('');
	const [force, setForce] = useState(false);

	const handleRename = () => {
		if (newName.trim()) {
			onRename(branchName, newName.trim());
			setNewName('');
			onOpenChange(false);
		}
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="fixed inset-0 bg-black/55" onClick={() => onOpenChange(false)} />
			<Card className="relative z-50 w-full ui-surface max-w-md mx-4">
				<CardHeader>
					<CardTitle>Rename Branch</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label>Current Name</Label>
						<Input value={branchName} disabled />
					</div>
					<div className="space-y-2">
						<Label htmlFor="new-name">New Name</Label>
						<Input
							id="new-name"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="Enter new branch name..."
							autoFocus
							onKeyDown={(e) => e.key === 'Enter' && handleRename()}
						/>
					</div>
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="force-rename"
							checked={force}
							onChange={(e) => setForce(e.target.checked)}
							className="h-4 w-4"
						/>
						<Label htmlFor="force-rename" className="cursor-pointer text-sm">
							Force rename (reset branch even if it already exists)
						</Label>
					</div>
				</CardContent>
				<CardFooter className="justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleRename} disabled={!newName.trim()}>
						Rename
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
