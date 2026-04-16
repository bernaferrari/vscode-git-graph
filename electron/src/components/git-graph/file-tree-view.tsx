/**
 * File Tree View
 * Hierarchical tree view for staging files
 */

import { ChevronRight, ChevronDown, FileText, Folder, Plus, Minus, RotateCcw } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Checkbox } from '@/components/ui/checkbox';

interface FileTreeItem {
	file: string;
	status: string;
}

interface TreeNode {
	name: string;
	path: string;
	isFolder: boolean;
	children: TreeNode[];
	status?: string;
}

interface FileTreeViewProps {
	files: FileTreeItem[];
	selectedFiles: Set<string>;
	onToggle: (path: string) => void;
	onToggleFolder: (paths: string[]) => void;
}

export function FileTreeView({ files, selectedFiles, onToggle, onToggleFolder }: FileTreeViewProps) {
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

	// Build tree from flat file list
	const tree = useMemo(() => {
		const root: TreeNode = { name: '', path: '', isFolder: true, children: [] };

		files.forEach((file) => {
			const parts = file.file.split('/');
			let current = root;

			parts.forEach((part, index) => {
				const isFile = index === parts.length - 1;
				const path = parts.slice(0, index + 1).join('/');

				const existingChild = current.children.find((c) => c.name === part);
				if (existingChild) {
					current = existingChild;
					return;
				}

				const nextChild: TreeNode = {
					name: part,
					path,
					isFolder: !isFile,
					children: [],
					...(isFile ? { status: file.status } : {}),
				};
				current.children.push(nextChild);
				current = nextChild;
			});
		});

		// Sort: folders first, then files, alphabetically
		const sortChildren = (node: TreeNode) => {
			node.children.sort((a, b) => {
				if (a.isFolder !== b.isFolder) {
					return a.isFolder ? -1 : 1;
				}
				return a.name.localeCompare(b.name);
			});
			node.children.forEach(sortChildren);
		};
		sortChildren(root);

		return root.children;
	}, [files]);

	const toggleFolder = (path: string) => {
		setExpandedFolders((prev) => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	};

	const getAllFilesInFolder = (node: TreeNode): string[] => {
		if (!node.isFolder) {
			return [node.path];
		}
		return node.children.flatMap(getAllFilesInFolder);
	};

	const getStatusIcon = (status?: string) => {
		switch (status) {
			case 'A':
				return <Plus className="h-3 w-3 text-green-600" />;
			case 'D':
				return <Minus className="h-3 w-3 text-red-600" />;
			case 'R':
				return <RotateCcw className="h-3 w-3 text-amber-600" />;
			default:
				return <FileText className="h-3 w-3 text-muted-foreground" />;
		}
	};

	const renderNode = (node: TreeNode, depth: number = 0) => {
		if (node.isFolder) {
			const isExpanded = expandedFolders.has(node.path);
			const allFiles = getAllFilesInFolder(node);
			const selectedCount = allFiles.filter((f) => selectedFiles.has(f)).length;
			const isAllSelected = selectedCount === allFiles.length;
			const isSomeSelected = selectedCount > 0 && selectedCount < allFiles.length;

			return (
				<div key={node.path}>
					<div
						className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-accent/50 cursor-pointer"
						style={{ paddingLeft: depth * 12 + 8 }}
						onClick={() => { toggleFolder(node.path); }}
					>
						<Checkbox
							checked={isAllSelected}
							ref={(el) => {
								if (el) {
									(el as HTMLButtonElement).dataset.state = isSomeSelected ? 'indeterminate' : isAllSelected ? 'checked' : 'unchecked';
								}
							}}
							onClick={(e) => {
								e.stopPropagation();
								onToggleFolder(isAllSelected ? [] : allFiles);
							}}
							className="h-3 w-3"
						/>
						{isExpanded ? (
							<ChevronDown className="h-3 w-3 text-muted-foreground" />
						) : (
							<ChevronRight className="h-3 w-3 text-muted-foreground" />
						)}
						<Folder className="h-3 w-3 text-amber-600" />
						<span className="text-xs truncate flex-1">{node.name}</span>
						<span className="text-[10px] text-muted-foreground">
							{allFiles.length}
						</span>
					</div>
					{isExpanded && (
						<div>
							{node.children.map((child) => renderNode(child, depth + 1))}
						</div>
					)}
				</div>
			);
		}

		return (
			<div
				key={node.path}
				className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-accent/50 cursor-pointer"
				style={{ paddingLeft: depth * 12 + 8 }}
				onClick={() => { onToggle(node.path); }}
			>
				<Checkbox
					checked={selectedFiles.has(node.path)}
					className="h-3 w-3"
					onClick={(e) => { e.stopPropagation(); }}
				/>
				{getStatusIcon(node.status)}
				<span className="text-xs truncate flex-1" title={node.path}>
					{node.name}
				</span>
			</div>
		);
	};

	return (
		<div className="space-y-0.5">
			{tree.map((node) => renderNode(node))}
		</div>
	);
}
