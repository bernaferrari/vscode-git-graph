import { Plus, X, FolderGit2, Star, StarOff, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
        <div className='bg-muted/20 border-border/70 flex items-center border-b px-1'>
            <ScrollArea className='flex-1'>
                <div className='flex h-9 items-center gap-1'>
                    {tabs.map((tab) => (
                        <div
                            key={tab.id}
                            role='button'
                            tabIndex={0}
                            className={`group flex h-7 max-w-[180px] min-w-0 items-center gap-1.5 rounded-md border px-2 text-xs transition-[background-color,border-color,color] ${
                                activeTabId === tab.id
                                    ? 'border-primary/30 bg-background text-foreground shadow-sm'
                                    : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/45 hover:text-foreground'
                            }`}
                            title={tab.path}
                            onClick={() => { onSelect(tab.id); }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onSelect(tab.id);
                                }
                            }}>
                            {tab.isStarred ? (
                                <Star className='h-3 w-3 fill-amber-500 text-amber-500' />
                            ) : (
                                <FolderGit2 className='h-3 w-3' />
                            )}
                            <span className='truncate'>{tab.name}</span>
                            <Button
                                variant='ghost'
                                size='icon-xs'
                                className='-mr-1 opacity-0 transition-opacity group-hover:opacity-100'
                                title='Close repository'
                                aria-label={`Close ${tab.name}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose(tab.id);
                                }}>
                                <X className='h-3 w-3' />
                            </Button>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation='horizontal' className='h-0' />
            </ScrollArea>
            <Button variant='ghost' size='icon-sm' className='ml-1' onClick={onAdd} title='Open repository' aria-label='Open repository'>
                <Plus className='h-4 w-4' />
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon-sm' title='Repository menu' aria-label='Repository menu'>
                        <MoreHorizontal className='h-4 w-4' />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={onAdd}>
                        <Plus className='mr-2 h-4 w-4' />
                        Open Repository
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {tabs.map((tab) => (
                        <DropdownMenuItem key={tab.id} onClick={() => { onStar(tab.id); }}>
                            {tab.isStarred ? (
                                <StarOff className='mr-2 h-4 w-4' />
                            ) : (
                                <Star className='mr-2 h-4 w-4' />
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
// eslint-disable-next-line react-refresh/only-export-components
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
		setActiveTabId: (id: string) => { setActiveTabId(id); },
		addTab,
		closeTab,
		starTab,
	};
}
