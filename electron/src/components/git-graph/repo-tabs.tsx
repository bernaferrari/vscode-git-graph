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
        <div className='flex items-center border-b border-border/70 bg-muted/20 px-1'>
            <ScrollArea className='flex-1'>
                <div className='flex h-9 items-center gap-0.5'>
                    {tabs.map((tab) => {
                        const active = activeTabId === tab.id;
                        return (
                            <div
                                key={tab.id}
                                role='button'
                                tabIndex={0}
                                aria-current={active ? 'page' : undefined}
                                className={`group/tab relative flex h-7 min-w-0 max-w-[200px] items-center gap-1.5 rounded-md px-2 text-[11.5px] transition-[background-color,color,box-shadow] duration-150 ${
                                    active
                                        ? 'bg-background text-foreground shadow-[var(--shadow-sm)] ring-1 ring-border/70'
                                        : 'text-muted-foreground hover:bg-accent/55 hover:text-foreground'
                                }`}
                                title={tab.path}
                                onClick={() => { onSelect(tab.id); }}
                                onAuxClick={(event) => {
                                    if (event.button === 1) {
                                        event.preventDefault();
                                        onClose(tab.id);
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(tab.id);
                                    }
                                }}>
                                {active && (
                                    <span
                                        aria-hidden
                                        className='pointer-events-none absolute inset-x-1.5 top-0 h-[2px] rounded-b-full bg-primary'
                                    />
                                )}
                                {tab.isStarred ? (
                                    <Star
                                        className='h-3 w-3 shrink-0 fill-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]'
                                        aria-hidden
                                    />
                                ) : (
                                    <FolderGit2
                                        className={`h-3 w-3 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground/85'}`}
                                        aria-hidden
                                    />
                                )}
                                <span className='truncate font-medium tracking-[-0.005em]'>{tab.name}</span>
                                <Button
                                    variant='ghost'
                                    size='icon-xs'
                                    className={`-mr-1 ml-0.5 shrink-0 transition-opacity ${
                                        active
                                            ? 'opacity-70 hover:opacity-100'
                                            : 'opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100'
                                    }`}
                                    title='Close repository'
                                    aria-label={`Close ${tab.name}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose(tab.id);
                                    }}>
                                    <X className='h-3 w-3' />
                                </Button>
                            </div>
                        );
                    })}
                </div>
                <ScrollBar orientation='horizontal' className='h-0' />
            </ScrollArea>
            <span aria-hidden className='mx-1 hidden h-5 w-px bg-border/70 md:block' />
            <Button
                variant='ghost'
                size='icon-sm'
                onClick={onAdd}
                title='Open repository'
                aria-label='Open repository'>
                <Plus className='h-4 w-4' />
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant='ghost'
                        size='icon-sm'
                        title='Repository menu'
                        aria-label='Repository menu'>
                        <MoreHorizontal className='h-4 w-4' />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='min-w-[14rem]'>
                    <DropdownMenuItem onClick={onAdd} className='gap-2'>
                        <Plus className='h-3.5 w-3.5' />
                        Open repository
                    </DropdownMenuItem>
                    {tabs.length > 0 && <DropdownMenuSeparator />}
                    {tabs.map((tab) => (
                        <DropdownMenuItem
                            key={tab.id}
                            onClick={() => { onStar(tab.id); }}
                            className='gap-2'>
                            {tab.isStarred ? (
                                <StarOff className='h-3.5 w-3.5 text-muted-foreground' />
                            ) : (
                                <Star className='h-3.5 w-3.5 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]' />
                            )}
                            <span className='truncate'>
                                {tab.isStarred ? 'Unstar' : 'Star'} {tab.name}
                            </span>
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
