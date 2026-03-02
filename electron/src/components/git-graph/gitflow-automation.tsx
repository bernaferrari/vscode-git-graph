/**
 * Git Flow Automation
 * Automate Git Flow workflows
 */

import {
	GitBranch,
	Plus,
	Check,
	X,
	Loader2,
	GitMerge,
	Tag,
	AlertTriangle,
	History,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';


interface GitFlowBranch {
	name: string;
	base: string;
	created?: string;
}

interface GitFlowAutomationProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function GitFlowAutomation({ open, onOpenChange }: GitFlowAutomationProps) {
	const { activeRepo } = useAppStore();
	const [activeTab, setActiveTab] = useState<'feature' | 'release' | 'hotfix'>('feature');
	const [newBranchName, setNewBranchName] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [isFinishing, setIsFinishing] = useState<string | null>(null);

	// Get branches
	const { data: branchData, refetch: refetchBranches } = trpc.git.branches.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	// Get current branch
	const { data: statusData } = trpc.git.status.useQuery(
		{ repo: activeRepo ?? '' },
		{ enabled: !!activeRepo && open }
	);

	const branches = branchData?.branches ?? [];
	const currentBranch = statusData?.branch ?? '';

	// Filter branches by type
	const featureBranches = branches.filter(b => b.name.startsWith('feature/'));
	const releaseBranches = branches.filter(b => b.name.startsWith('release/'));
	const hotfixBranches = branches.filter(b => b.name.startsWith('hotfix/'));

	// Create branch mutation
	const createBranchMutation = trpc.git.createBranch.useMutation({
		onSuccess: () => {
			toast.success(`Created ${activeTab} branch`);
			setNewBranchName('');
			setIsCreating(false);
			refetchBranches();
		},
		onError: (error) => {
			toast.error('Failed to create branch', { description: error.message });
			setIsCreating(false);
		},
	});

	// Checkout mutation
	const checkoutMutation = trpc.git.checkout.useMutation({
		onSuccess: () => {
			toast.success('Branch checked out');
			refetchBranches();
		},
		onError: (error) => {
			toast.error('Failed to checkout', { description: error.message });
		},
	});

	// Merge mutation (for finishing)
	const mergeMutation = trpc.git.merge.useMutation({
		onSuccess: () => {
			toast.success('Branch merged');
			setIsFinishing(null);
			refetchBranches();
		},
		onError: (error) => {
			toast.error('Failed to merge', { description: error.message });
			setIsFinishing(null);
		},
	});

	// Delete branch mutation
	const deleteBranchMutation = trpc.git.deleteBranch.useMutation({
		onSuccess: () => {
			toast.success('Branch deleted');
			refetchBranches();
		},
		onError: (error) => {
			toast.error('Failed to delete branch', { description: error.message });
		},
	});

	const getBaseBranch = (type: 'feature' | 'release' | 'hotfix') => {
		switch (type) {
			case 'feature': return 'develop';
			case 'release': return 'develop';
			case 'hotfix': return 'main';
			default: return 'main';
		}
	};

	const handleCreate = () => {
		if (!newBranchName.trim()) {
			toast.error('Please enter a branch name');
			return;
		}

		setIsCreating(true);
		const fullBranchName = `${activeTab}/${newBranchName}`;
		const baseBranch = getBaseBranch(activeTab);

		createBranchMutation.mutate({
			repo: activeRepo ?? '',
			name: fullBranchName,
			commitHash: '', // Will use HEAD
			checkout: true,
		});
	};

	const handleStart = (branchName: string) => {
		checkoutMutation.mutate({
			repo: activeRepo ?? '',
			branch: branchName,
		});
	};

	const handleFinish = (branchName: string) => {
		setIsFinishing(branchName);
		
		// Determine merge target based on branch type
		let targetBranch: string;
		if (branchName.startsWith('feature/')) {
			targetBranch = 'develop';
		} else if (branchName.startsWith('release/')) {
			targetBranch = 'main';
		} else if (branchName.startsWith('hotfix/')) {
			targetBranch = 'main'; // Also merge to develop after
		} else {
			targetBranch = 'main';
		}

		mergeMutation.mutate({
			repo: activeRepo ?? '',
			sourceBranch: branchName,
			targetBranch,
		});
	};

	const handleDelete = (branchName: string) => {
		if (confirm(`Delete branch ${branchName}?`)) {
			deleteBranchMutation.mutate({
				repo: activeRepo ?? '',
				branch: branchName,
			});
		}
	};

	const renderBranchList = (type: 'feature' | 'release' | 'hotfix', branchList: typeof branches) => (
		<div className="space-y-2">
			{branchList.length === 0 ? (
				<div className="text-center py-8 text-muted-foreground">
					<GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
					<p>No {type} branches</p>
				</div>
			) : (
				branchList.map((branch) => (
					<div
						key={branch.name}
						className={`flex items-center gap-3 p-3 rounded-lg border ${
							branch.name === currentBranch 
								? 'border-primary bg-accent/50' 
								: 'hover:bg-accent/30'
						}`}
					>
						<GitBranch className="h-4 w-4 text-muted-foreground" />
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="font-mono text-sm truncate">
									{branch.name.replace(`${type}/`, '')}
								</span>
								{branch.name === currentBranch && (
									<Badge variant="outline" className="text-xs">
										Current
									</Badge>
								)}
							</div>
							<span className="text-xs text-muted-foreground">
								{branch.name}
							</span>
						</div>
						<div className="flex items-center gap-1">
							{branch.name !== currentBranch && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => { handleStart(branch.name); }}
								>
									Start
								</Button>
							)}
							<Button
								variant="outline"
								size="sm"
								onClick={() => { handleFinish(branch.name); }}
								disabled={isFinishing === branch.name}
							>
								{isFinishing === branch.name ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<GitMerge className="h-4 w-4" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="text-red-600"
								onClick={() => { handleDelete(branch.name); }}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					</div>
				))
			)}
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col ui-surface">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<GitBranch className="h-5 w-5" />
						Git Flow
					</DialogTitle>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as typeof activeTab); }} className="flex-1 flex flex-col">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="feature">
							Feature
							{featureBranches.length > 0 && (
								<Badge variant="secondary" className="ml-2">
									{featureBranches.length}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="release">
							Release
							{releaseBranches.length > 0 && (
								<Badge variant="secondary" className="ml-2">
									{releaseBranches.length}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="hotfix">
							Hotfix
							{hotfixBranches.length > 0 && (
								<Badge variant="secondary" className="ml-2">
									{hotfixBranches.length}
								</Badge>
							)}
						</TabsTrigger>
					</TabsList>

					<div className="py-4">
						<div className="flex items-center gap-2 mb-4">
							<Input
								placeholder={`New ${activeTab} name...`}
								value={newBranchName}
								onChange={(e) => { setNewBranchName(e.target.value); }}
								onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
								className="flex-1"
							/>
							<Button
								onClick={handleCreate}
								disabled={isCreating || !newBranchName.trim()}
							>
								{isCreating ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Plus className="h-4 w-4" />
								)}
							</Button>
						</div>

						<div className="text-xs text-muted-foreground mb-4">
							Base branch: <code className="bg-muted px-1 rounded">{getBaseBranch(activeTab)}</code>
						</div>

						<ScrollArea className="flex-1">
							<TabsContent value="feature" className="m-0">
								{renderBranchList('feature', featureBranches)}
							</TabsContent>
							<TabsContent value="release" className="m-0">
								{renderBranchList('release', releaseBranches)}
							</TabsContent>
							<TabsContent value="hotfix" className="m-0">
								{renderBranchList('hotfix', hotfixBranches)}
							</TabsContent>
						</ScrollArea>
					</div>
				</Tabs>

				<div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
					<AlertTriangle className="h-3 w-3" />
					<span>
						Finish merges to {activeTab === 'hotfix' ? 'main (then develop)' : activeTab === 'release' ? 'main' : 'develop'}
					</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default GitFlowAutomation;
