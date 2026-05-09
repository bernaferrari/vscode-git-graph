/**
 * Archive Creation Dialog
 */

import { Archive, FileArchive, Loader2, Package } from 'lucide-react';
import { useState } from 'react';

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
import { trpc } from '@/trpc/client';

interface ArchiveDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	repo: string;
	ref: string;
	refName: string;
}

type ArchiveFormat = 'zip' | 'tar' | 'tar.gz';

const FORMAT_OPTIONS: {
	value: ArchiveFormat;
	label: string;
	description: string;
	icon: typeof Archive;
}[] = [
	{ value: 'zip', label: 'ZIP', description: 'Cross-platform, opens everywhere', icon: Archive },
	{ value: 'tar.gz', label: 'TAR.GZ', description: 'Compressed Unix archive', icon: Package },
	{ value: 'tar', label: 'TAR', description: 'Uncompressed tarball', icon: FileArchive },
];

const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85';

export function ArchiveDialog({
	open,
	onOpenChange,
	repo,
	ref,
	refName,
}: ArchiveDialogProps) {
	const [format, setFormat] = useState<ArchiveFormat>('zip');
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
		// The tRPC router shows a save dialog when no path is provided —
		// clearing the input triggers that flow.
		setOutputPath('');
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-md gap-0 overflow-hidden p-0'>
				<DialogHeader className='space-y-1 border-b border-border/60 px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className='grid h-7 w-7 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
							<Archive className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='font-semibold'>Create archive</span>
						<span className='font-mono text-[11px] text-muted-foreground/85'>{refName}</span>
					</DialogTitle>
					<DialogDescription className='text-[11px] text-muted-foreground/85'>
						Snapshot this ref as a downloadable archive.
					</DialogDescription>
				</DialogHeader>

				<div className='space-y-4 px-5 py-4'>
					<div className='space-y-1.5'>
						<Label className={labelClass}>Format</Label>
						<div className='grid grid-cols-3 gap-1.5'>
							{FORMAT_OPTIONS.map((opt) => {
								const Icon = opt.icon;
								const selected = format === opt.value;
								return (
									<button
										key={opt.value}
										type='button'
										onClick={() => { setFormat(opt.value); }}
										className={cn(
											'group/format relative flex flex-col items-start gap-1 rounded-lg border bg-card/40 p-2.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45',
											selected
												? 'border-primary/55 bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] ring-1 ring-primary/20'
												: 'border-border/70 hover:border-border hover:bg-card/70',
										)}>
										{selected && (
											<span aria-hidden className='absolute inset-y-2.5 left-0 w-[2px] rounded-r-full bg-primary' />
										)}
										<span className='flex items-center gap-1.5'>
											<Icon className={cn('h-3.5 w-3.5', selected ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
											<span className='text-[12px] font-semibold'>{opt.label}</span>
										</span>
										<span className='text-[10px] leading-snug text-muted-foreground/85'>
											{opt.description}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					<div className='space-y-1.5'>
						<Label className={labelClass}>Output path (optional)</Label>
						<div className='flex gap-1.5'>
							<Input
								value={outputPath}
								onChange={(e) => { setOutputPath(e.target.value); }}
								placeholder='Leave empty to choose on save…'
								className='flex-1 font-mono'
							/>
							<Button variant='outline' size='sm' onClick={handleBrowse}>
								Browse…
							</Button>
						</div>
					</div>

					<div className='space-y-1.5'>
						<Label className={labelClass}>Prefix (optional)</Label>
						<Input
							value={prefix}
							onChange={(e) => { setPrefix(e.target.value); }}
							placeholder='e.g. project-name/'
							className='font-mono'
						/>
						<p className='text-[10px] text-muted-foreground/75'>
							All files inside the archive will live under this directory.
						</p>
					</div>
				</div>

				<footer className='flex items-center justify-end gap-2 border-t border-border/60 bg-muted/15 px-5 py-3'>
					<Button variant='outline' size='sm' onClick={() => { onOpenChange(false); }}>
						Cancel
					</Button>
					<Button size='sm' onClick={handleCreate} disabled={archiveMutation.isPending}>
						{archiveMutation.isPending ? (
							<>
								<Loader2 className='mr-1.5 h-3.5 w-3.5 animate-spin' />
								Creating…
							</>
						) : (
							'Create archive'
						)}
					</Button>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
