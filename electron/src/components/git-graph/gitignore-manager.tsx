/**
 * Gitignore Management
 * UI for viewing and editing .gitignore files
 */

import { Check, FileText, Loader2, Plus, RefreshCw, Save, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';


// Common gitignore patterns organized by category
const COMMON_PATTERNS: Record<string, string[]> = {
	'Node.js': [
		'node_modules/',
		'dist/',
		'build/',
		'.env',
		'.env.local',
		'*.log',
		'npm-debug.log*',
		'yarn-debug.log*',
		'yarn-error.log*',
	],
	'Python': [
		'__pycache__/',
		'*.py[cod]',
		'*$py.class',
		'.Python',
		'venv/',
		'env/',
		'.venv/',
		'*.so',
		'.env',
	],
	'IDE': [
		'.idea/',
		'.vscode/',
		'*.swp',
		'*.swo',
		'*~',
		'.DS_Store',
		'Thumbs.db',
	],
	'JavaScript/TypeScript': [
		'*.tsbuildinfo',
		'.eslintcache',
		'.parcel-cache/',
		'.wwebjs/',
	],
	'React': [
		'build/',
		'.cache/',
	],
	'Rust': [
		'target/',
		'**/*.rs.bk',
		'*.pdb',
	],
	'Go': [
		'*.exe',
		'*.exe~',
		'*.dll',
		'*.so',
		'*.dylib',
		'*.test',
		'*.out',
		'go.work',
	],
	'MacOS': [
		'.DS_Store',
		'.AppleDouble',
		'.LSOverride',
		'._*',
		'.DocumentRevisions-V100',
	],
	'Windows': [
		'Thumbs.db',
		'Thumbs.db:encryptable',
		'ehthumbs.db',
		'ehthumbs_vista.db',
		'*.stackdump',
	],
};

interface GitignoreManagerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function GitignoreManager({ open, onOpenChange }: GitignoreManagerProps) {
	const { activeRepo } = useAppStore();
	const [content, setContent] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [hasChanges, setHasChanges] = useState(false);

	// Load .gitignore content
	const { data: readFileData, refetch } = trpc.git.readFile.useQuery(
		{ repo: activeRepo ?? '', path: '.gitignore' },
		{ enabled: !!activeRepo && open }
	);

	useEffect(() => {
		if (!open) return;
		setContent(readFileData?.content ?? '');
		setHasChanges(false);
	}, [open, readFileData?.content]);

	// Save mutation
	const saveMutation = trpc.git.writeFile.useMutation({
		onSuccess: () => {
			toast.success('.gitignore saved');
			setHasChanges(false);
			void refetch();
		},
		onError: (error: unknown) => {
			toast.error('Failed to save .gitignore', {
				description: error instanceof Error ? error.message : 'Unknown error',
			});
		},
	});

	const handleSave = () => {
		saveMutation.mutate({
			repo: activeRepo ?? '',
			path: '.gitignore',
			content,
		});
	};

	const addPattern = (pattern: string) => {
		setContent(prev => {
			const newContent = prev.trimEnd() + '\n' + pattern;
			setHasChanges(true);
			return newContent;
		});
	};

	const filteredCategories = useMemo(() => {
		const entries = Object.entries(COMMON_PATTERNS);
		if (!searchQuery) return entries;
		const q = searchQuery.toLowerCase();
		return entries
			.map(([category, patterns]) => {
				const filtered = patterns.filter((p) => p.toLowerCase().includes(q));
				return [category, filtered] as [string, string[]];
			})
			.filter(([, patterns]) => patterns.length > 0);
	}, [searchQuery]);

	const existingPatterns = useMemo(() => {
		const set = new Set<string>();
		content.split('\n').forEach((line) => {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) set.add(trimmed);
		});
		return set;
	}, [content]);

	const lineCount = content.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0'>
				<DialogHeader className='space-y-1 border-b border-border/60 px-5 py-4'>
					<DialogTitle className='flex items-center gap-2 text-[0.9375rem]'>
						<span className='grid h-7 w-7 place-items-center rounded-md bg-primary/12 ring-1 ring-primary/20'>
							<FileText className='h-3.5 w-3.5 text-primary' />
						</span>
						<span className='font-mono font-semibold'>.gitignore</span>
						<span className='font-mono text-[11px] text-muted-foreground/85'>
							{lineCount} pattern{lineCount === 1 ? '' : 's'}
						</span>
						{hasChanges && (
							<span className='ml-auto inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklch,var(--warning)_30%,transparent)] bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'>
								<span aria-hidden className='inline-block h-1 w-1 rounded-full bg-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]' />
								Unsaved
							</span>
						)}
					</DialogTitle>
					<DialogDescription className='text-[11px] text-muted-foreground/85'>
						Tell Git which paths to leave alone. Add common patterns from the side panel or type your own.
					</DialogDescription>
				</DialogHeader>

				<div className='flex min-h-0 flex-1 gap-3 px-5 py-4'>
					{/* Editor */}
					<div className='flex flex-1 flex-col overflow-hidden rounded-xl border border-border/70'>
						<div className='flex items-center justify-between border-b border-border/60 bg-muted/15 px-3 py-1.5'>
							<span className='font-mono text-[11px] tabular-nums text-muted-foreground/85'>.gitignore</span>
							<div className='flex items-center gap-1'>
								<Button
									variant='ghost'
									size='sm'
									className='h-6 w-6 p-0'
									onClick={() => { void refetch(); }}
									title='Reload from disk'
									aria-label='Reload from disk'>
									<RefreshCw className='h-3.5 w-3.5' />
								</Button>
								<Button
									size='sm'
									className='h-6 gap-1 px-2 text-[11px]'
									onClick={handleSave}
									disabled={!hasChanges || saveMutation.isPending}>
									{saveMutation.isPending ? (
										<Loader2 className='h-3 w-3 animate-spin' />
									) : (
										<Save className='h-3 w-3' />
									)}
									Save
								</Button>
							</div>
						</div>
						<Textarea
							value={content}
							onChange={(e) => {
								setContent(e.target.value);
								setHasChanges(true);
							}}
							className='flex-1 resize-none rounded-none border-0 font-mono text-[12px] leading-relaxed focus-visible:ring-0'
							placeholder={'# Add patterns to ignore\nnode_modules/\n.env\ndist/'}
						/>
					</div>

					{/* Pattern suggestions */}
					<div className='flex w-64 flex-col overflow-hidden rounded-xl border border-border/70'>
						<div className='border-b border-border/60 bg-muted/15 px-3 py-1.5'>
							<span className='text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
								Quick add
							</span>
						</div>
						<div className='border-b border-border/60 px-2 py-2'>
							<div className='relative'>
								<Search className='pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70' />
								<Input
									placeholder='Search patterns…'
									value={searchQuery}
									onChange={(e) => { setSearchQuery(e.target.value); }}
									className='h-7 pl-7 font-mono text-[11px]'
								/>
							</div>
						</div>
						<ScrollArea className='flex-1'>
							<div className='space-y-3 p-2'>
								{filteredCategories.length === 0 ? (
									<p className='px-2 py-6 text-center text-[11px] text-muted-foreground/85'>
										No patterns match.
									</p>
								) : (
									filteredCategories.map(([category, patterns]) => (
										<div key={category}>
											<h4 className='mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
												{category}
											</h4>
											<div className='space-y-0.5'>
												{patterns.map((pattern) => {
													const added = existingPatterns.has(pattern);
													return (
														<button
															key={pattern}
															type='button'
															disabled={added}
															onClick={() => { addPattern(pattern); }}
															title={added ? 'Already in .gitignore' : `Add ${pattern}`}
															className={cn(
																'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-mono text-[11px] tabular-nums transition-colors',
																added
																	? 'cursor-default text-muted-foreground/60'
																	: 'text-foreground/85 hover:bg-accent/55 hover:text-foreground',
															)}>
															{added ? (
																<Check className='h-3 w-3 shrink-0 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />
															) : (
																<Plus className='h-3 w-3 shrink-0 text-muted-foreground/85' />
															)}
															<span className='truncate'>{pattern}</span>
														</button>
													);
												})}
											</div>
										</div>
									))
								)}
							</div>
						</ScrollArea>
					</div>
				</div>

				<footer className='flex items-center justify-between gap-3 border-t border-border/60 bg-muted/15 px-5 py-3'>
					<p className='text-[11px] text-muted-foreground/85'>
						Patterns already in your file show a check.
					</p>
					<Button variant='outline' size='sm' onClick={() => { onOpenChange(false); }}>
						Close
					</Button>
				</footer>
			</DialogContent>
		</Dialog>
	);
}
