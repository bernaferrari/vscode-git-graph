/**
 * Archive Creation Dialog
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

interface ArchiveDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	repo: string;
	ref: string;
	refName: string;
}

export function ArchiveDialog({
	open,
	onOpenChange,
	repo,
	ref,
	refName,
}: ArchiveDialogProps) {
	const [format, setFormat] = useState<'zip' | 'tar' | 'tar.gz'>('zip');
	const [outputPath, setOutputPath] = useState('');
	const [prefix, setPrefix] = useState('');

	const archiveMutation = trpc.git.archive.useMutation({
		onSuccess: () => {
			onOpenChange(false);
		},
	});

	const handleCreate = () => {
		archiveMutation.mutate({
			repo,
			ref,
			format,
			outputPath: outputPath || undefined,
			prefix: prefix || undefined,
		});
	};

	const handleBrowse = () => {
		// The tRPC router will handle showing the save dialog if no path is provided
		// Just clear the output path to trigger the dialog
		setOutputPath('');
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
			<Card className="relative z-50 w-full max-w-md mx-4">
				<CardHeader>
					<CardTitle>Create Archive</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label>Reference</Label>
						<Input value={refName} disabled />
					</div>

					<div className="space-y-2">
						<Label>Format</Label>
						<Select value={format} onValueChange={(v) => v && setFormat(v as 'zip' | 'tar' | 'tar.gz')}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="zip">ZIP</SelectItem>
								<SelectItem value="tar">TAR</SelectItem>
								<SelectItem value="tar.gz">TAR.GZ</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Output Path (optional)</Label>
						<div className="flex gap-2">
							<Input
								value={outputPath}
								onChange={(e) => setOutputPath(e.target.value)}
								placeholder="Leave empty for default..."
								className="flex-1"
							/>
							<Button variant="outline" onClick={handleBrowse}>
								Browse
							</Button>
						</div>
					</div>

					<div className="space-y-2">
						<Label>Prefix (optional)</Label>
						<Input
							value={prefix}
							onChange={(e) => setPrefix(e.target.value)}
							placeholder="Directory prefix for files..."
						/>
					</div>
				</CardContent>
				<CardFooter className="justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleCreate} disabled={archiveMutation.isPending}>
						{archiveMutation.isPending ? 'Creating...' : 'Create Archive'}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
