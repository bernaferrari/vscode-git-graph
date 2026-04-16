/**
 * File Tree Component
 * Hierarchical file tree with expand/collapse
 */

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
				current = existing.children!;
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
				current = node.children!;
			}
		}
	}

	return root;
}

function getFileIcon(name: string) {
	const ext = name.split('.').pop()?.toLowerCase();

	if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext ?? '')) {
		return <Image className="h-4 w-4 text-purple-500" />;
	}
	if (['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h'].includes(ext ?? '')) {
		return <FileCode className="h-4 w-4 text-blue-500" />;
	}
	if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'ini', 'cfg'].includes(ext ?? '')) {
		return <FileText className="h-4 w-4 text-amber-500" />;
	}
	if (['exe', 'dll', 'so', 'dylib', 'bin', 'pak'].includes(ext ?? '')) {
		return <Binary className="h-4 w-4 text-gray-500" />;
	}
	return <FileText className="h-4 w-4 text-gray-500" />;
}

function getStatusColor(status?: string) {
	switch (status) {
		case 'added': return 'text-green-600';
		case 'deleted': return 'text-red-600';
		case 'renamed': return 'text-amber-600';
		case 'modified': return 'text-amber-500';
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
							"flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-accent/50",
							isSelected && "bg-accent"
						)}
						style={{ paddingLeft: `${level * 12 + 8}px` }}
					>
						{isOpen ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
						{isOpen ? (
							<FolderOpen className="h-4 w-4 text-amber-500" />
						) : (
							<Folder className="h-4 w-4 text-amber-500" />
						)}
						<span className="text-sm truncate">{node.name}</span>
						<span className="text-xs text-muted-foreground ml-auto">
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
				"flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-accent/50 group",
				isSelected && "bg-accent"
			)}
			style={{ paddingLeft: `${level * 12 + 28}px` }}
			onClick={() => onFileClick?.(node.path)}
		>
			{getFileIcon(node.name)}
			<span className="text-sm truncate flex-1">{node.name}</span>
			<span className={cn("text-xs font-mono", getStatusColor(node.status))}>
				{getStatusLabel(node.status)}
			</span>
			{(node.additions !== undefined || node.deletions !== undefined) && (
				<div className="flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100">
					{node.additions !== undefined && node.additions > 0 && (
						<span className="text-green-600">+{node.additions}</span>
					)}
					{node.deletions !== undefined && node.deletions > 0 && (
						<span className="text-red-600">-{node.deletions}</span>
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
			<div className="text-center py-4 text-muted-foreground text-sm">
				No files
			</div>
		);
	}

	return (
		<div className="py-1">
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
