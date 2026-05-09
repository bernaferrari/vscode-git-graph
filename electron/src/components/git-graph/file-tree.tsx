/**
 * File Tree Component
 * Hierarchical file tree with expand/collapse
 */

import {
	ChevronRight,
	ChevronDown,
	Folder,
	FolderOpen,
	FileCode,
	FileText,
	Image,
	Binary,
} from 'lucide-react';
import { useState, useMemo } from 'react';

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface FileNode {
	name: string;
	path: string;
	type: 'file' | 'folder';
	children?: FileNode[] | undefined;
	additions?: number | undefined;
	deletions?: number | undefined;
	status?: 'added' | 'modified' | 'deleted' | 'renamed' | undefined;
}

interface FileTreeProps {
	files: Array<{
		path: string;
		additions?: number;
		deletions?: number;
		status?: 'added' | 'modified' | 'deleted' | 'renamed';
	}>;
	onFileClick?: (path: string) => void;
	selectedPath?: string;
}

function buildTree(files: FileTreeProps['files']): FileNode[] {
	const root: FileNode[] = [];

	for (const file of files) {
		const parts = file.path.split('/');
		let current = root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (!part) {
				continue;
			}
			const isFile = i === parts.length - 1;
			const existing = current.find((n) => n.name === part);

			if (existing) {
				current = existing.children ?? [];
			} else {
				const node: FileNode = {
					name: part,
					path: parts.slice(0, i + 1).join('/'),
					type: isFile ? 'file' : 'folder',
					children: isFile ? undefined : [],
					additions: isFile ? file.additions : undefined,
					deletions: isFile ? file.deletions : undefined,
					status: isFile ? file.status : undefined,
				};
				current.push(node);
				current = node.children ?? [];
			}
		}
	}

	return root;
}

function getFileIcon(name: string) {
	const ext = name.split('.').pop()?.toLowerCase();

	if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext ?? '')) {
		return <Image className="h-3.5 w-3.5 text-chart-5" />;
	}
	if (['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h'].includes(ext ?? '')) {
		return <FileCode className="h-3.5 w-3.5 text-chart-1" />;
	}
	if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'ini', 'cfg'].includes(ext ?? '')) {
		return <FileText className="h-3.5 w-3.5 text-chart-3" />;
	}
	if (['exe', 'dll', 'so', 'dylib', 'bin', 'pak'].includes(ext ?? '')) {
		return <Binary className="h-3.5 w-3.5 text-muted-foreground" />;
	}
	return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getStatusColor(status?: string) {
	switch (status) {
		case 'added': return 'text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]';
		case 'deleted': return 'text-destructive';
		case 'renamed': return 'text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))]';
		case 'modified': return 'text-[color-mix(in_oklch,var(--info)_70%,var(--foreground))]';
		default: return '';
	}
}

function getStatusLabel(status?: string) {
	switch (status) {
		case 'added': return 'A';
		case 'deleted': return 'D';
		case 'renamed': return 'R';
		case 'modified': return 'M';
		default: return '';
	}
}

interface TreeNodeProps {
	node: FileNode;
	level: number;
	onFileClick: ((path: string) => void) | undefined;
	selectedPath: string | undefined;
}

function TreeNode({ node, level, onFileClick, selectedPath }: TreeNodeProps) {
	const [isOpen, setIsOpen] = useState(level < 2);
	const isSelected = selectedPath === node.path;

	if (node.type === 'folder') {
		return (
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<CollapsibleTrigger className="w-full">
					<div
						className={cn(
							"group/folder flex h-7 items-center gap-1.5 rounded px-1.5 cursor-pointer text-[0.8125rem] transition-colors",
							isSelected ? "bg-accent text-foreground" : "text-foreground/85 hover:bg-accent/55 hover:text-foreground"
						)}
						style={{ paddingLeft: `${String(level * 12 + 6)}px` }}
					>
						<span className="grid h-3 w-3 shrink-0 place-items-center text-muted-foreground">
							{isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
						</span>
						{isOpen ? (
							<FolderOpen className="h-3.5 w-3.5 shrink-0 text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))]" />
						) : (
							<Folder className="h-3.5 w-3.5 shrink-0 text-[color-mix(in_oklch,var(--warning)_55%,var(--foreground))]" />
						)}
						<span className="flex-1 truncate font-medium">{node.name}</span>
						<span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/70">
							{node.children?.length}
						</span>
					</div>
				</CollapsibleTrigger>
				<CollapsibleContent>
					{node.children?.map((child) => (
						<TreeNode
							key={child.path}
							node={child}
							level={level + 1}
							onFileClick={onFileClick}
							selectedPath={selectedPath}
						/>
					))}
				</CollapsibleContent>
			</Collapsible>
		);
	}

	return (
		<div
			className={cn(
				"group/file relative flex h-7 items-center gap-1.5 rounded px-1.5 cursor-pointer text-[0.8125rem] transition-colors",
				isSelected ? "bg-accent text-foreground" : "text-foreground/85 hover:bg-accent/55 hover:text-foreground"
			)}
			style={{ paddingLeft: `${String(level * 12 + 22)}px` }}
			onClick={() => onFileClick?.(node.path)}
		>
			{isSelected && (
				<span aria-hidden className="absolute inset-y-1 left-0 w-[2px] rounded-r-full bg-primary" />
			)}
			{getFileIcon(node.name)}
			<span className="font-mono truncate flex-1">{node.name}</span>
			{node.status && (
				<span className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold leading-none", getStatusColor(node.status))}>
					{getStatusLabel(node.status)}
				</span>
			)}
			{(node.additions !== undefined || node.deletions !== undefined) && (
				<div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums opacity-60 group-hover/file:opacity-100">
					{node.additions !== undefined && node.additions > 0 && (
						<span className="text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]">+{node.additions}</span>
					)}
					{node.deletions !== undefined && node.deletions > 0 && (
						<span className="text-destructive">−{node.deletions}</span>
					)}
				</div>
			)}
		</div>
	);
}

export function FileTree({ files, onFileClick, selectedPath }: FileTreeProps) {
	const tree = useMemo(() => buildTree(files), [files]);

	if (files.length === 0) {
		return (
			<div className="py-6 text-center text-muted-foreground/85 text-[0.8125rem]">
				No files
			</div>
		);
	}

	return (
		<div className="space-y-px py-1">
			{tree.map((node) => (
				<TreeNode
					key={node.path}
					node={node}
					level={0}
					onFileClick={onFileClick}
					selectedPath={selectedPath}
				/>
			))}
		</div>
	);
}

export default FileTree;
