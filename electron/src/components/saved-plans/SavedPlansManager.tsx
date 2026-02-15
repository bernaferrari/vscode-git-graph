/**
 * Saved Plans Management
 * Store, share, and reuse rewrite plans
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import {
	Save,
	FolderOpen,
	Share2,
	Trash2,
	Edit,
	Copy,
	Download,
	Upload,
	Clock,
	Check,
	X,
	GitBranch,
	MoreHorizontal,
	ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export interface SavedPlan {
	id: string;
	name: string;
	description: string;
	sourceBranch: string;
	baseBranch: string;
	operations: SavedPlanOp[];
	createdAt: number;
	updatedAt: number;
	status: 'draft' | 'validated' | 'applied';
	shared: boolean;
	tags: string[];
}

export interface SavedPlanOp {
	type: string;
	commitHash: string;
	message: string;
	target?: string;
}

interface SavedPlansManagerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onLoadPlan: (plan: SavedPlan) => void;
	onApplyPlan: (plan: SavedPlan) => void;
}

// Demo plans for UI
const DEMO_PLANS: SavedPlan[] = [
	{
		id: 'demo-1',
		name: 'Clean up WIP commits',
		description: 'Remove debug logs and squash related fixes',
		sourceBranch: 'feature/login',
		baseBranch: 'main',
		operations: [
			{ type: 'drop', commitHash: 'a1b2c3d', message: 'WIP debug' },
			{ type: 'squash', commitHash: 'e5f6g7h', message: 'Fix typo' },
		],
		createdAt: Date.now() - 86400000,
		updatedAt: Date.now() - 3600000,
		status: 'draft',
		shared: false,
		tags: ['cleanup'],
	},
	{
		id: 'demo-2',
		name: 'Rebase onto main',
		description: 'Update feature branch with latest main',
		sourceBranch: 'feature/api',
		baseBranch: 'main',
		operations: [
			{ type: 'rebase_onto', commitHash: '', message: '', target: 'main' },
		],
		createdAt: Date.now() - 172800000,
		updatedAt: Date.now() - 7200000,
		status: 'validated',
		shared: true,
		tags: ['rebase'],
	},
];

export function SavedPlansManager({
	open,
	onOpenChange,
	onLoadPlan,
	onApplyPlan,
}: SavedPlansManagerProps) {
	const [plans, setPlans] = useState<SavedPlan[]>(DEMO_PLANS);
	const [selectedPlan, setSelectedPlan] = useState<SavedPlan | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [filterTags, setFilterTags] = useState<string[]>([]);

	// All unique tags
	const allTags = [...new Set(plans.flatMap(p => p.tags))];

	// Filter plans
	const filteredPlans = plans.filter(plan => {
		const matchesSearch = !searchQuery || 
			plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			plan.description.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesTags = filterTags.length === 0 ||
			filterTags.some(tag => plan.tags.includes(tag));
		return matchesSearch && matchesTags;
	});

	// Delete plan
	const deletePlan = useCallback((id: string) => {
		setPlans(prev => prev.filter(p => p.id !== id));
		if (selectedPlan?.id === id) {
			setSelectedPlan(null);
		}
	}, [selectedPlan]);

	// Duplicate plan
	const duplicatePlan = useCallback((plan: SavedPlan) => {
		const newPlan: SavedPlan = {
			...plan,
			id: `plan-${Date.now()}`,
			name: `${plan.name} (copy)`,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			status: 'draft',
			shared: false,
		};
		setPlans(prev => [...prev, newPlan]);
	}, []);

	// Toggle share
	const toggleShare = useCallback((id: string) => {
		setPlans(prev =>
			prev.map(p =>
				p.id === id ? { ...p, shared: !p.shared, updatedAt: Date.now() } : p
			)
		);
	}, []);

	const statusColors = {
		draft: 'bg-yellow-500',
		validated: 'bg-blue-500',
		applied: 'bg-green-500',
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-3xl">
				<SheetHeader className="mb-4">
					<SheetTitle className="flex items-center gap-2">
						<Save className="h-5 w-5" />
						Saved Plans
					</SheetTitle>
				</SheetHeader>

				{/* Search & Filters */}
				<div className="space-y-3 mb-4">
					<Input
						placeholder="Search plans..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-9"
					/>
					<div className="flex flex-wrap gap-1">
						{allTags.map(tag => (
							<Badge
								key={tag}
								variant={filterTags.includes(tag) ? 'default' : 'outline'}
								className="cursor-pointer"
								onClick={() => setFilterTags(prev =>
									prev.includes(tag)
										? prev.filter(t => t !== tag)
										: [...prev, tag]
								)}
							>
								{tag}
							</Badge>
						))}
					</div>
				</div>

				<div className="flex gap-4">
					{/* Plan List */}
					<div className="w-1/2 space-y-2">
						<ScrollArea className="h-[calc(100vh-16rem)]">
							{filteredPlans.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<Save className="h-12 w-12 mx-auto mb-3 opacity-30" />
									<p>No saved plans</p>
									<p className="text-xs mt-1">
										Create a rewrite plan and save it
									</p>
								</div>
							) : (
								filteredPlans.map(plan => (
									<Card
										key={plan.id}
										className={cn(
											'cursor-pointer transition-colors',
											selectedPlan?.id === plan.id && 'border-primary'
										)}
										onClick={() => setSelectedPlan(plan)}
									>
										<CardContent className="p-3">
											<div className="flex items-start justify-between">
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<span className="font-medium truncate">{plan.name}</span>
														<div className={cn('w-2 h-2 rounded-full', statusColors[plan.status])} />
													</div>
													<p className="text-xs text-muted-foreground truncate mt-1">
														{plan.sourceBranch} → {plan.baseBranch}
													</p>
													<div className="flex items-center gap-2 mt-1">
														<Badge variant="outline" className="text-[10px]">
															{plan.operations.length} ops
														</Badge>
														{plan.shared && (
															<Share2 className="h-3 w-3 text-blue-500" />
														)}
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								))
							)}
						</ScrollArea>
					</div>

					{/* Plan Details */}
					<div className="w-1/2">
						{selectedPlan ? (
							<Card>
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between">
										<CardTitle className="text-base">{selectedPlan.name}</CardTitle>
										<div className="flex gap-1">
											<Tooltip>
												<TooltipTrigger asChild>
													<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
														<Edit className="h-4 w-4" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>Edit plan</TooltipContent>
											</Tooltip>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0"
														onClick={() => duplicatePlan(selectedPlan)}
													>
														<Copy className="h-4 w-4" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>Duplicate</TooltipContent>
											</Tooltip>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0 text-red-500"
														onClick={() => deletePlan(selectedPlan.id)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>Delete</TooltipContent>
											</Tooltip>
										</div>
									</div>
									<CardDescription>{selectedPlan.description}</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										<div className="flex items-center gap-2 text-sm">
											<GitBranch className="h-4 w-4 text-muted-foreground" />
											<span>{selectedPlan.sourceBranch}</span>
											<span className="text-muted-foreground">→</span>
											<span>{selectedPlan.baseBranch}</span>
										</div>

										<div className="text-xs text-muted-foreground">
											{selectedPlan.operations.length} operations
										</div>

										<div className="flex flex-wrap gap-1">
											{selectedPlan.tags.map(tag => (
												<Badge key={tag} variant="outline" className="text-xs">
													{tag}
												</Badge>
											))}
										</div>

										<div className="text-xs text-muted-foreground flex items-center gap-1">
											<Clock className="h-3 w-3" />
											Updated {formatDistanceToNow(selectedPlan.updatedAt, { addSuffix: true })}
										</div>

										<div className="flex gap-2 pt-2">
											<Button
												size="sm"
												className="flex-1"
												onClick={() => {
													onLoadPlan(selectedPlan);
													onOpenChange(false);
												}}
											>
												<FolderOpen className="h-4 w-4 mr-1" />
												Load
											</Button>
											<Button
												size="sm"
												variant="outline"
												className="flex-1"
												onClick={() => {
													onApplyPlan(selectedPlan);
													onOpenChange(false);
												}}
											>
												<Play className="h-4 w-4 mr-1" />
												Apply
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						) : (
							<div className="text-center py-8 text-muted-foreground">
								<p>Select a plan to view details</p>
							</div>
						)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}

// Import Play icon
import { Play } from 'lucide-react';
