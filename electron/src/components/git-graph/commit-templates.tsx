/**
 * Commit Templates
 * Predefined commit message templates for consistency
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	Plus,
	Trash2,
	Edit,
	Copy,
	Check,
	FileText,
	Search,
} from 'lucide-react';

export interface CommitTemplate {
	id: string;
	name: string;
	description?: string;
	content: string;
	isDefault?: boolean;
}

interface CommitTemplatesProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect?: (template: CommitTemplate) => void;
	templates: CommitTemplate[];
	onTemplatesChange: (templates: CommitTemplate[]) => void;
}

const DEFAULT_TEMPLATES: CommitTemplate[] = [
	{
		id: 'feat',
		name: 'Feature',
		description: 'New feature',
		content: 'feat: \n\n',
		isDefault: true,
	},
	{
		id: 'fix',
		name: 'Bug Fix',
		description: 'Bug fix',
		content: 'fix: \n\n',
		isDefault: true,
	},
	{
		id: 'docs',
		name: 'Documentation',
		description: 'Documentation changes',
		content: 'docs: \n\n',
		isDefault: true,
	},
	{
		id: 'refactor',
		name: 'Refactor',
		description: 'Code refactoring',
		content: 'refactor: \n\n',
		isDefault: true,
	},
	{
		id: 'test',
		name: 'Test',
		description: 'Adding tests',
		content: 'test: \n\n',
		isDefault: true,
	},
	{
		id: 'chore',
		name: 'Chore',
		description: 'Maintenance tasks',
		content: 'chore: \n\n',
		isDefault: true,
	},
];

const STORAGE_KEY = 'git-graph-commit-templates';

export function useCommitTemplates() {
	const [templates, setTemplates] = useState<CommitTemplate[]>([]);

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				setTemplates(JSON.parse(stored));
			} catch {
				setTemplates(DEFAULT_TEMPLATES);
			}
		} else {
			setTemplates(DEFAULT_TEMPLATES);
		}
	}, []);

	useEffect(() => {
		if (templates.length > 0) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
		}
	}, [templates]);

	const addTemplate = (template: Omit<CommitTemplate, 'id'>) => {
		const newTemplate: CommitTemplate = {
			...template,
			id: Date.now().toString(),
		};
		setTemplates(prev => [...prev, newTemplate]);
	};

	const updateTemplate = (id: string, updates: Partial<CommitTemplate>) => {
		setTemplates(prev => prev.map(t => 
			t.id === id ? { ...t, ...updates } : t
		));
	};

	const deleteTemplate = (id: string) => {
		setTemplates(prev => prev.filter(t => t.id !== id));
	};

	const duplicateTemplate = (id: string) => {
		const template = templates.find(t => t.id === id);
		if (template) {
			addTemplate({
				...template,
				name: `${template.name} (Copy)`,
				isDefault: false,
			});
		}
	};

	return {
		templates,
		addTemplate,
		updateTemplate,
		deleteTemplate,
		duplicateTemplate,
	};
}

export function CommitTemplatesDialog({
	open,
	onOpenChange,
	onSelect,
	templates,
	onTemplatesChange,
}: CommitTemplatesProps) {
	const [searchQuery, setSearchQuery] = useState('');
	const [editingTemplate, setEditingTemplate] = useState<CommitTemplate | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [newTemplate, setNewTemplate] = useState<Omit<CommitTemplate, 'id'>>({
		name: '',
		description: '',
		content: '',
	});

	const filteredTemplates = templates.filter(t =>
		t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
		t.content.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const handleSelect = (template: CommitTemplate) => {
		onSelect?.(template);
		onOpenChange(false);
	};

	const handleSaveNew = () => {
		if (!newTemplate.name || !newTemplate.content) return;
		const newId = Date.now().toString();
		onTemplatesChange([...templates, { ...newTemplate, id: newId }]);
		setNewTemplate({ name: '', description: '', content: '' });
		setIsCreating(false);
	};

	const handleUpdate = () => {
		if (!editingTemplate) return;
		onTemplatesChange(templates.map(t =>
			t.id === editingTemplate.id ? editingTemplate : t
		));
		setEditingTemplate(null);
	};

	const handleDelete = (id: string) => {
		onTemplatesChange(templates.filter(t => t.id !== id));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						Commit Templates
					</DialogTitle>
				</DialogHeader>

				<div className="flex items-center gap-2 py-2">
					<div className="relative flex-1">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search templates..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8"
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsCreating(true)}
					>
						<Plus className="h-4 w-4 mr-1" />
						New
					</Button>
				</div>

				<ScrollArea className="flex-1">
					{isCreating && (
						<div className="p-4 border rounded-lg mb-4 bg-muted/30">
							<h4 className="font-medium mb-3">New Template</h4>
							<div className="space-y-3">
								<Input
									placeholder="Template name"
									value={newTemplate.name}
									onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
								/>
								<Input
									placeholder="Description (optional)"
									value={newTemplate.description ?? ''}
									onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
								/>
								<Textarea
									placeholder="Template content (use {description} as placeholder)"
									value={newTemplate.content}
									onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
									className="font-mono text-sm min-h-[100px]"
								/>
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setIsCreating(false);
											setNewTemplate({ name: '', description: '', content: '' });
										}}
									>
										Cancel
									</Button>
									<Button size="sm" onClick={handleSaveNew}>
										Save
									</Button>
								</div>
							</div>
						</div>
					)}

					{editingTemplate && (
						<div className="p-4 border rounded-lg mb-4 bg-muted/30">
							<h4 className="font-medium mb-3">Edit Template</h4>
							<div className="space-y-3">
								<Input
									placeholder="Template name"
									value={editingTemplate.name}
									onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
								/>
								<Input
									placeholder="Description (optional)"
									value={editingTemplate.description ?? ''}
									onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
								/>
								<Textarea
									placeholder="Template content"
									value={editingTemplate.content}
									onChange={(e) => setEditingTemplate(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
									className="font-mono text-sm min-h-[100px]"
								/>
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setEditingTemplate(null)}
									>
										Cancel
									</Button>
									<Button size="sm" onClick={handleUpdate}>
										Save Changes
									</Button>
								</div>
							</div>
						</div>
					)}

					<div className="space-y-2">
						{filteredTemplates.map((template) => (
							<div
								key={template.id}
								className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer group"
								onClick={() => handleSelect(template)}
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<span className="font-medium">{template.name}</span>
										{template.isDefault && (
											<span className="text-xs px-1.5 py-0.5 rounded bg-muted">
												Built-in
											</span>
										)}
									</div>
									{template.description && (
										<p className="text-xs text-muted-foreground mb-1">
											{template.description}
										</p>
									)}
									<pre className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded truncate">
										{template.content}
									</pre>
								</div>
								<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
									<Button
										variant="ghost"
										size="sm"
										className="h-7 w-7 p-0"
										onClick={(e) => {
											e.stopPropagation();
											setEditingTemplate(template);
										}}
									>
										<Edit className="h-3 w-3" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 w-7 p-0"
										onClick={(e) => {
											e.stopPropagation();
											// Duplicate logic
										}}
									>
										<Copy className="h-3 w-3" />
									</Button>
									{!template.isDefault && (
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0 text-red-600"
											onClick={(e) => {
												e.stopPropagation();
												handleDelete(template.id);
											}}
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									)}
								</div>
							</div>
						))}

						{filteredTemplates.length === 0 && (
							<div className="text-center py-8 text-muted-foreground">
								<FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p>No templates found</p>
							</div>
						)}
					</div>
				</ScrollArea>

				<div className="text-xs text-muted-foreground pt-2 border-t">
					Tip: Type <code className="bg-muted px-1 rounded">t:</code> in the commit message field to quickly access templates
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Template quick insert component for commit panel
interface TemplateQuickInsertProps {
	onSelect: (template: CommitTemplate) => void;
	templates: CommitTemplate[];
}

export function TemplateQuickInsert({ onSelect, templates }: TemplateQuickInsertProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [filter, setFilter] = useState('');

	const filtered = templates.filter(t =>
		t.name.toLowerCase().includes(filter.toLowerCase())
	).slice(0, 6);

	return (
		<div className="relative">
			<Button
				variant="ghost"
				size="sm"
				className="h-7 px-2 text-xs"
				onClick={() => setIsOpen(!isOpen)}
			>
				<FileText className="h-3 w-3 mr-1" />
				Template
			</Button>

			{isOpen && (
				<div className="absolute bottom-full left-0 mb-1 w-48 rounded-md border bg-popover p-1 shadow-lg z-50">
					<Input
						placeholder="Search..."
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="h-7 text-xs mb-1"
						autoFocus
					/>
					{filtered.map((template) => (
						<button
							key={template.id}
							className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent"
							onClick={() => {
								onSelect(template);
								setIsOpen(false);
								setFilter('');
							}}
						>
							{template.name}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
