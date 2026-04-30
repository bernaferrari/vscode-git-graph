/**
 * Git Flow Toolbar
 * Start/finish feature, release, hotfix branches
 */

import {
	GitBranch,
	Play,
	Flag,
	Flame,
	Check,
	ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useGitOperations } from '@/hooks/useGitOperations';

interface GitFlowToolbarProps {
	currentBranch: string;
}

type FlowType = 'feature' | 'release' | 'hotfix';

export function GitFlowToolbar({ currentBranch }: GitFlowToolbarProps) {
	const gitOps = useGitOperations();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [flowType, setFlowType] = useState<FlowType>('feature');
	const [action, setAction] = useState<'start' | 'finish'>('start');
	const [name, setName] = useState('');
	const [tagName, setTagName] = useState('');

	// Detect if current branch is a git-flow branch
	const getBranchInfo = (): { type: FlowType | null; name: string } | null => {
		if (currentBranch.startsWith('feature/')) {
			return { type: 'feature', name: currentBranch.replace('feature/', '') };
		}
		if (currentBranch.startsWith('release/')) {
			return { type: 'release', name: currentBranch.replace('release/', '') };
		}
		if (currentBranch.startsWith('hotfix/')) {
			return { type: 'hotfix', name: currentBranch.replace('hotfix/', '') };
		}
		return null;
	};

	const branchInfo = getBranchInfo();

	const openDialog = (type: FlowType, act: 'start' | 'finish') => {
		setFlowType(type);
		setAction(act);
		setName(branchInfo?.name ?? '');
		setTagName('');
		setDialogOpen(true);
	};

	const handleAction = async () => {
		if (!name.trim()) return;

		switch (flowType) {
			case 'feature':
				if (action === 'start') {
					await gitOps.gitFlowFeatureStart(name);
				} else {
					await gitOps.gitFlowFeatureFinish(name);
				}
				break;
			case 'release':
				if (action === 'start') {
					await gitOps.gitFlowReleaseStart(name);
				} else {
					await gitOps.gitFlowReleaseFinish(name, tagName || undefined);
				}
				break;
			case 'hotfix':
				if (action === 'start') {
					await gitOps.gitFlowHotfixStart(name);
				} else {
					await gitOps.gitFlowHotfixFinish(name, tagName || undefined);
				}
				break;
		}

		setDialogOpen(false);
	};

	const FLOW_CONFIG = {
		feature: {
			icon: GitBranch,
			color: 'text-blue-500',
			label: 'Feature',
			description: 'Start a new feature branch from develop',
		},
		release: {
			icon: Flag,
			color: 'text-green-500',
			label: 'Release',
			description: 'Start a new release branch from develop',
		},
		hotfix: {
			icon: Flame,
			color: 'text-red-500',
			label: 'Hotfix',
			description: 'Start a new hotfix branch from master',
		},
	};

	return (
		<>
			<div className="flex items-center gap-1">
				{/* Feature dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
							<GitBranch className="h-3 w-3 text-blue-500" />
							<span className="hidden sm:inline">Feature</span>
							<ChevronDown className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem onClick={() => { openDialog('feature', 'start'); }}>
							<Play className="h-4 w-4 mr-2 text-blue-500" />
							Start New Feature
						</DropdownMenuItem>
						{branchInfo?.type === 'feature' && (
							<DropdownMenuItem onClick={() => { openDialog('feature', 'finish'); }}>
								<Check className="h-4 w-4 mr-2 text-green-500" />
								Finish Feature: {branchInfo.name}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Release dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
							<Flag className="h-3 w-3 text-green-500" />
							<span className="hidden sm:inline">Release</span>
							<ChevronDown className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem onClick={() => { openDialog('release', 'start'); }}>
							<Play className="h-4 w-4 mr-2 text-green-500" />
							Start New Release
						</DropdownMenuItem>
						{branchInfo?.type === 'release' && (
							<DropdownMenuItem onClick={() => { openDialog('release', 'finish'); }}>
								<Check className="h-4 w-4 mr-2 text-green-500" />
								Finish Release: {branchInfo.name}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Hotfix dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
							<Flame className="h-3 w-3 text-red-500" />
							<span className="hidden sm:inline">Hotfix</span>
							<ChevronDown className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem onClick={() => { openDialog('hotfix', 'start'); }}>
							<Play className="h-4 w-4 mr-2 text-red-500" />
							Start New Hotfix
						</DropdownMenuItem>
						{branchInfo?.type === 'hotfix' && (
							<DropdownMenuItem onClick={() => { openDialog('hotfix', 'finish'); }}>
								<Check className="h-4 w-4 mr-2 text-green-500" />
								Finish Hotfix: {branchInfo.name}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-md ui-surface">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<FlowIcon type={flowType} className={`h-5 w-5 ${FLOW_CONFIG[flowType].color}`} />
								{action === 'start' ? 'Start' : 'Finish'} {FLOW_CONFIG[flowType].label}
							</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">
								{FLOW_CONFIG[flowType].label} Name
							</label>
							<Input
								placeholder={`e.g., ${flowType === 'feature' ? 'user-authentication' : flowType === 'release' ? 'v1.2.0' : 'critical-bug'}`}
								value={name}
								onChange={(e) => { setName(e.target.value); }}
							/>
						</div>
						{action === 'finish' && (flowType === 'release' || flowType === 'hotfix') && (
							<div className="space-y-2">
								<label className="text-sm font-medium">
									Tag Name (optional)
								</label>
								<Input
									placeholder="e.g., v1.2.0"
									value={tagName}
									onChange={(e) => { setTagName(e.target.value); }}
								/>
							</div>
						)}
						<p className="text-xs text-muted-foreground">
							{action === 'start'
								? FLOW_CONFIG[flowType].description
								: `This will merge ${flowType}/${name} back and clean up the branch.`}
						</p>
					</div>
					<DialogFooter className="ui-toolbar">
						<Button variant="outline" onClick={() => { setDialogOpen(false); }}>
							Cancel
						</Button>
						<Button onClick={() => { void handleAction(); }} disabled={!name.trim()}>
							{action === 'start' ? 'Start' : 'Finish'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function FlowIcon({ type, className }: { type: FlowType; className?: string }) {
	switch (type) {
		case 'feature':
			return <GitBranch className={className} />;
		case 'release':
			return <Flag className={className} />;
		case 'hotfix':
			return <Flame className={className} />;
	}
}
