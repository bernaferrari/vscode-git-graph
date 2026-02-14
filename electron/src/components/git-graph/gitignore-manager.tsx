/**
 * Gitignore Management
 * UI for viewing and editing .gitignore files
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	FileText,
	Plus,
	Trash2,
	RefreshCw,
	Save,
	Search,
	GitBranch,
} from 'lucide-react';
import { toast } from 'sonner';

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
	const { data: gitignoreData, isLoading, refetch } = trpc.git.readFile.useQuery(
		{ repo: activeRepo ?? '', path: '.gitignore' },
		{ 
			enabled: !!activeRepo && open,
			onSuccess: (data) => {
				setContent(data?.content ?? '');
				setHasChanges(false);
			}
		}
	);

	// Save mutation
	const saveMutation = trpc.git.writeFile.useMutation({
		onSuccess: () => {
			toast.success('.gitignore saved');
			setHasChanges(false);
			refetch();
		},
		onError: (error) => {
			toast.error('Failed to save .gitignore', { description: error.message });
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
		if (!searchQuery) return Object.entries(COMMON_PATTERNS);
		
		return Object.entries(COMMON_PATTERNS).map(([category, patterns]) => {
			const filtered = patterns.filter(p => 
				p.toLowerCase().includes(searchQuery.toLowerCase())
			);
			return [category, filtered] as [string, string[]];
		}).filter(([_, patterns]) => patterns.length > 0);
	}, [searchQuery]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						.gitignore
						{hasChanges && (
							<span className="text-xs text-amber-600 font-normal">
								(unsaved changes)
							</span>
						)}
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 flex gap-4 min-h-0">
					{/* Editor */}
					<div className="flex-1 flex flex-col border rounded-lg">
						<div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
							<span className="text-sm font-mono">.gitignore</span>
							<div className="flex items-center gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => refetch()}
								>
									<RefreshCw className="h-4 w-4" />
								</Button>
								<Button
									size="sm"
									onClick={handleSave}
									disabled={!hasChanges || saveMutation.isPending}
								>
									<Save className="h-4 w-4 mr-1" />
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
							className="flex-1 font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0"
							placeholder="# Add patterns to ignore...&#10;node_modules/&#10;.env&#10;dist/"
						/>
					</div>

					{/* Pattern suggestions */}
					<div className="w-64 flex flex-col border rounded-lg">
						<div className="px-3 py-2 border-b bg-muted/30">
							<span className="text-sm font-medium">Quick Add</span>
						</div>
						<div className="p-2 border-b">
							<Input
								placeholder="Search patterns..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-8"
							/>
						</div>
						<ScrollArea className="flex-1">
							<div className="p-2 space-y-3">
								{filteredCategories.map(([category, patterns]) => (
									<div key={category}>
										<h4 className="text-xs font-medium text-muted-foreground mb-1">
											{category}
										</h4>
										<div className="space-y-1">
											{patterns.map((pattern) => (
												<button
													key={pattern}
													className="w-full text-left px-2 py-1 text-xs font-mono rounded hover:bg-accent flex items-center gap-2"
													onClick={() => addPattern(pattern)}
												>
													<Plus className="h-3 w-3 text-muted-foreground" />
													{pattern}
												</button>
											))}
										</div>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>
				</div>

				<div className="text-xs text-muted-foreground pt-2 border-t">
					Tip: Add patterns from the sidebar or type your own in the editor
				</div>
			</DialogContent>
		</Dialog>
	);
}
