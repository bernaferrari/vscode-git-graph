/**
 * Repository Tabs
 * Support for working with multiple repositories simultaneously
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
	Plus,
	X,
	FolderGit2,
	Star,
	StarOff,
	MoreHorizontal,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RepoTab {
	id: string;
	name: string;
	path: string;
	isStarred: boolean;
}

interface RepoTabsProps {
	tabs: RepoTab[];
	activeTabId: string | null;
	onSelect: (tabId: string) => void;
	onClose: (tabId: string) => void;
	onAdd: () => void;
	onStar: (tabId: string) => void;
}

export function RepoTabs({
	tabs,
	activeTabId,
	onSelect,
	onClose,
	onAdd,
	onStar,
}: RepoTabsProps) {
	return (
		<div className="flex items-center border-b bg-muted/30">
			<ScrollArea className="flex-1">
				<div className="flex items-center h-9">
					{tabs.map((tab) => (
						<div
							key={tab.id}
							className={`group flex items-center gap-1.5 px-3 h-9 border-r cursor-pointer transition-colors ${
								activeTabId === tab.id
									? 'bg-background border-b-2 border-b-primary'
									: 'hover:bg-accent/50'
							}`}
							onClick={() => onSelect(tab.id)}
						>
							{tab.isStarred ? (
								<Star className="h-3 w-3 text-amber-500 fill-amber-500" />
							) : (
								<FolderGit2 className="h-3 w-3 text-muted-foreground" />
							)}
							<span className="text-xs truncate max-w-[120px]">{tab.name}</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={(e) => {
									e.stopPropagation();
									onClose(tab.id);
								}}
							>
								<X className="h-3 w-3" />
							</Button>
						</div>
					))}
				</div>
				<ScrollBar orientation="horizontal" className="h-0" />
			</ScrollArea>
			<Button variant="ghost" size="sm" className="h-8 w-8 px-0 ml-1" onClick={onAdd}>
				<Plus className="h-4 w-4" />
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="sm" className="h-8 w-8 px-0">
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={onAdd}>
						<Plus className="h-4 w-4 mr-2" />
						Open Repository
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{tabs.map((tab) => (
						<DropdownMenuItem key={tab.id} onClick={() => onStar(tab.id)}>
							{tab.isStarred ? (
								<StarOff className="h-4 w-4 mr-2" />
							) : (
								<Star className="h-4 w-4 mr-2" />
							)}
							{tab.isStarred ? 'Unstar' : 'Star'} {tab.name}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

// Hook for managing repo tabs
export function useRepoTabs() {
	const [tabs, setTabs] = useState<RepoTab[]>([]);
	const [activeTabId, setActiveTabId] = useState<string | null>(null);

	const addTab = (path: string, name?: string) => {
		const id = path;
		const tabName = name || path.split('/').pop() || 'Repository';

		// Check if tab already exists
		const existing = tabs.find((t) => t.id === id);
		if (existing) {
			setActiveTabId(id);
			return existing;
		}

		const newTab: RepoTab = {
			id,
			name: tabName,
			path,
			isStarred: false,
		};
		setTabs((prev) => [...prev, newTab]);
		setActiveTabId(id);
		return newTab;
	};

	const closeTab = (tabId: string) => {
		setTabs((prev) => prev.filter((t) => t.id !== tabId));
		if (activeTabId === tabId) {
			const remaining = tabs.filter((t) => t.id !== tabId);
			setActiveTabId(remaining[remaining.length - 1]?.id ?? null);
		}
	};

	const starTab = (tabId: string) => {
		setTabs((prev) =>
			prev.map((t) =>
				t.id === tabId ? { ...t, isStarred: !t.isStarred } : t
			)
		);
	};

	const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

	return {
		tabs,
		activeTab,
		activeTabId,
		setActiveTabId: (id: string) => setActiveTabId(id),
		addTab,
		closeTab,
		starTab,
	};
}
