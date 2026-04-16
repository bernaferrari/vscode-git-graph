/**
 * Main Navigation Sidebar
 * Unified sidebar for all lens modes with PLAN as differentiator
 */

import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { useLensMode } from '@/components/lens';
import {
	// Home
	Home,
	Activity,
	// Work
	GitBranch,
	GitCommit,
	FileEdit,
	FolderTree,
	// History
	History,
	Files,
	GitCompare,
	// Plan (differentiator)
	Edit3,
	Save,
	GitPullRequest,
	// Collab
	Users,
	CheckCircle,
	MessageSquare,
	// Tools
	AlertTriangle,
	Archive,
	FolderGit2,
	Package,
	// Settings
	Settings,
	User,
	Shield,
	Keyboard,
	ChevronDown,
	ChevronRight,
	Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
	id: string;
	label: string;
	icon: React.ElementType;
	badge?: number | string;
	children?: NavItem[];
	lensModes: ('guided' | 'craft' | 'control')[];
	collapsed?: boolean;
}

interface NavSection {
	id: string;
	label: string;
	icon: React.ElementType;
	items: NavItem[];
	defaultExpanded: boolean;
}

const NAV_SECTIONS: NavSection[] = [
	{
		id: 'home',
		label: 'Home',
		icon: Home,
		defaultExpanded: true,
		items: [
			{ id: 'overview', label: 'Overview', icon: Home, lensModes: ['guided'] },
			{ id: 'activity', label: 'Activity', icon: Activity, lensModes: ['guided', 'craft'] },
		],
	},
	{
		id: 'work',
		label: 'Work',
		icon: GitBranch,
		defaultExpanded: true,
		items: [
			{ id: 'changes', label: 'Changes', icon: FileEdit, badge: 'new', lensModes: ['guided', 'craft', 'control'] },
			{ id: 'commit', label: 'Commit Series', icon: GitCommit, lensModes: ['craft', 'control'] },
			{ id: 'branches', label: 'Branches', icon: GitBranch, lensModes: ['guided', 'craft', 'control'] },
			{ id: 'stacks', label: 'Stacks', icon: FolderTree, lensModes: ['craft', 'control'] },
		],
	},
	{
		id: 'history',
		label: 'History',
		icon: History,
		defaultExpanded: false,
		items: [
			{ id: 'graph', label: 'Graph', icon: History, lensModes: ['guided', 'craft', 'control'] },
			{ id: 'files', label: 'Files', icon: Files, lensModes: ['craft', 'control'] },
			{ id: 'compare', label: 'Compare', icon: GitCompare, lensModes: ['craft', 'control'] },
		],
	},
	{
		id: 'plan',
		label: 'PLAN',
		icon: Edit3,
		defaultExpanded: true,
		items: [
			{ id: 'whatif', label: 'What‑If Preview', icon: Sparkles, badge: 'NEW', lensModes: ['guided', 'craft', 'control'] },
			{ id: 'rewrite', label: 'Rewrite Plan', icon: Edit3, lensModes: ['craft', 'control'] },
			{ id: 'saved-plans', label: 'Saved Plans', icon: Save, lensModes: ['craft', 'control'] },
		],
	},
	{
		id: 'collab',
		label: 'Collab',
		icon: Users,
		defaultExpanded: false,
		items: [
			{ id: 'reviews', label: 'Reviews / PRs', icon: GitPullRequest, lensModes: ['guided', 'craft', 'control'] },
			{ id: 'ci', label: 'CI Checks', icon: CheckCircle, lensModes: ['craft', 'control'] },
			{ id: 'discussions', label: 'Discussions', icon: MessageSquare, lensModes: ['control'] },
		],
	},
	{
		id: 'tools',
		label: 'Tools',
		icon: AlertTriangle,
		defaultExpanded: false,
		items: [
			{ id: 'conflicts', label: 'Conflicts', icon: AlertTriangle, badge: '!', lensModes: ['guided', 'craft', 'control'] },
			{ id: 'stashes', label: 'Stashes', icon: Archive, lensModes: ['craft', 'control'] },
			{ id: 'worktrees', label: 'Worktrees', icon: FolderGit2, lensModes: ['control'] },
			{ id: 'submodules', label: 'Submodules', icon: Package, lensModes: ['control'] },
		],
	},
	{
		id: 'settings',
		label: 'Settings',
		icon: Settings,
		defaultExpanded: false,
		items: [
			{ id: 'profiles', label: 'Profiles', icon: User, lensModes: ['guided', 'craft', 'control'] },
			{ id: 'repo-policy', label: 'Repo Policy', icon: Shield, lensModes: ['control'] },
			{ id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, lensModes: ['craft', 'control'] },
			{ id: 'preferences', label: 'Preferences', icon: Settings, lensModes: ['guided', 'craft', 'control'] },
		],
	},
];

interface MainNavigationProps {
	activeItem: string;
	onItemSelect: (itemId: string) => void;
	className?: string;
}

export function MainNavigation({ activeItem, onItemSelect, className }: MainNavigationProps) {
	const { mode } = useLensMode();
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(NAV_SECTIONS.filter(s => s.defaultExpanded).map(s => s.id))
	);

	const toggleSection = (sectionId: string) => {
		setExpandedSections(prev => {
			const next = new Set(prev);
			if (next.has(sectionId)) {
				next.delete(sectionId);
			} else {
				next.add(sectionId);
			}
			return next;
		});
	};

	// Filter items based on lens mode
	const visibleSections = useMemo(() => {
		return NAV_SECTIONS.map(section => ({
			...section,
			items: section.items.filter(item => item.lensModes.includes(mode)),
		})).filter(section => section.items.length > 0);
	}, [mode]);

	return (
		<nav className={cn('flex flex-col h-full', className)}>
			<ScrollArea className="flex-1">
				<div className="p-2 space-y-1">
					{visibleSections.map((section) => {
						const SectionIcon = section.icon;
						const isExpanded = expandedSections.has(section.id);

						return (
							<div key={section.id}>
								{/* Section Header */}
								<button
									onClick={() => toggleSection(section.id)}
									className={cn(
										'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
										section.id === 'plan' ? 'text-amber-600' : 'text-muted-foreground',
										'hover:bg-accent hover:text-foreground'
									)}
								>
									{section.id === 'plan' && <Sparkles className="h-4 w-4 text-amber-500" />}
									{isExpanded ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
									<SectionIcon className={cn('h-4 w-4', section.id === 'plan' && 'text-amber-500')} />
									<span className={cn(section.id === 'plan' && 'text-amber-600 dark:text-amber-400')}>
										{section.label}
									</span>
								</button>

								{/* Section Items */}
								{isExpanded && (
									<div className="ml-2 mt-1 space-y-0.5">
										{section.items.map((item) => {
											const ItemIcon = item.icon;
											const isActive = activeItem === item.id;

											return (
												<button
													key={item.id}
													onClick={() => onItemSelect(item.id)}
													className={cn(
														'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
														isActive
															? 'bg-primary/10 text-primary'
															: 'text-muted-foreground hover:bg-accent hover:text-foreground'
													)}
												>
													<ItemIcon className="h-4 w-4 shrink-0" />
													<span className="flex-1 text-left truncate">{item.label}</span>
													{item.badge && (
														<Badge
															variant={item.badge === 'NEW' ? 'default' : 'destructive'}
															className="h-5 px-1.5 text-xs"
														>
															{item.badge}
														</Badge>
													)}
												</button>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</ScrollArea>
		</nav>
	);
}

// Mobile/Sheet version
export function NavigationSheet({
	children,
}: {
	children: React.ReactElement;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger render={children} />
			<SheetContent side="left" className="w-72 p-0">
				<SheetHeader className="p-4 border-b">
					<SheetTitle className="flex items-center gap-2">
						<GitBranch className="h-5 w-5" />
						Git Graph
					</SheetTitle>
				</SheetHeader>
				<div className="h-[calc(100vh-4rem)]">
					<MainNavigation
						activeItem="graph"
						onItemSelect={(id) => {
							console.log('Navigate to:', id);
							setOpen(false);
						}}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
