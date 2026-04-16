/**
 * Git Flow Panel
 */

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/trpc/client';

interface GitFlowPanelProps {
	repo: string;
}

type FlowBranch = 'feature' | 'release' | 'hotfix' | 'support';

export function GitFlowPanel({ repo }: GitFlowPanelProps) {
	const utils = trpc.useUtils();
	const { data: flowStatus } = trpc.git.flow.status.useQuery({ repo }, { enabled: !!repo });

	const initMutation = trpc.git.flow.init.useMutation({
		onSuccess: () => utils.git.flow.status.invalidate(),
	});

	const startMutation = trpc.git.flow.start.useMutation({
		onSuccess: () => {
			utils.git.flow.status.invalidate();
			utils.git.repoInfo.invalidate();
		},
	});

	const finishMutation = trpc.git.flow.finish.useMutation({
		onSuccess: () => {
			utils.git.flow.status.invalidate();
			utils.git.repoInfo.invalidate();
		},
	});

	const [prefixes, setPrefixes] = useState({
		feature: 'feature/',
		release: 'release/',
		hotfix: 'hotfix/',
		support: 'support/',
		versionTag: '',
	});

	const [branchName, setBranchName] = useState('');
	const [branchType, setBranchType] = useState<FlowBranch>('feature');

	const handleInit = () => {
		initMutation.mutate({ repo, prefixes });
	};

	const handleStart = () => {
		if (branchName.trim()) {
			startMutation.mutate({ repo, type: branchType, name: branchName });
			setBranchName('');
		}
	};

	const handleFinish = (type: FlowBranch, name: string) => {
		finishMutation.mutate({ repo, type, name });
	};

	const isInitialized = flowStatus?.initialized ?? false;
	const activeBranches = flowStatus?.activeBranches ?? {};

	return (
		<Card className="h-full">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm flex items-center justify-between">
					<span>Git Flow</span>
					<Badge variant={isInitialized ? 'default' : 'secondary'}>
						{isInitialized ? 'Initialized' : 'Not Initialized'}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{!isInitialized ? (
					<div className="space-y-2">
						<p className="text-xs text-muted-foreground">
							Initialize Git Flow with default prefixes:
						</p>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div>
								<Label className="text-xs">Feature</Label>
								<Input
									value={prefixes.feature}
									onChange={(e) => { setPrefixes({ ...prefixes, feature: e.target.value }); }}
									className="h-7 text-xs"
								/>
							</div>
							<div>
								<Label className="text-xs">Release</Label>
								<Input
									value={prefixes.release}
									onChange={(e) => { setPrefixes({ ...prefixes, release: e.target.value }); }}
									className="h-7 text-xs"
								/>
							</div>
							<div>
								<Label className="text-xs">Hotfix</Label>
								<Input
									value={prefixes.hotfix}
									onChange={(e) => { setPrefixes({ ...prefixes, hotfix: e.target.value }); }}
									className="h-7 text-xs"
								/>
							</div>
							<div>
								<Label className="text-xs">Support</Label>
								<Input
									value={prefixes.support}
									onChange={(e) => { setPrefixes({ ...prefixes, support: e.target.value }); }}
									className="h-7 text-xs"
								/>
							</div>
						</div>
						<Button size="sm" onClick={handleInit} className="w-full">
							Initialize Git Flow
						</Button>
					</div>
				) : (
					<>
						{/* Start new branch */}
						<div className="space-y-2">
							<Label className="text-xs">Start New Branch</Label>
							<div className="flex gap-2">
								<Select value={branchType} onValueChange={(v) => v && setBranchType(v as FlowBranch)}>
									<SelectTrigger className="w-24 h-8">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="feature">Feature</SelectItem>
										<SelectItem value="release">Release</SelectItem>
										<SelectItem value="hotfix">Hotfix</SelectItem>
									</SelectContent>
								</Select>
								<Input
									value={branchName}
									onChange={(e) => { setBranchName(e.target.value); }}
									placeholder="Branch name..."
									className="h-8 flex-1"
								/>
								<Button size="sm" onClick={handleStart} disabled={!branchName}>
									Start
								</Button>
							</div>
						</div>

						<Separator />

						{/* Active branches */}
						<div className="space-y-2">
							<Label className="text-xs">Active Branches</Label>
							{Object.entries(activeBranches as Record<string, string[]>).map(([type, branches]) => (
								branches && branches.length > 0 && (
									<div key={type} className="space-y-1">
										<div className="text-xs font-medium capitalize">{type}</div>
										{branches.map((branch: string) => (
											<div
												key={branch}
												className="flex items-center justify-between p-1 rounded text-xs"
											>
												<span className="truncate">{branch}</span>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 px-2"
													onClick={() => { handleFinish(type as FlowBranch, branch); }}
												>
													Finish
												</Button>
											</div>
										))}
									</div>
								)
							))}
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
