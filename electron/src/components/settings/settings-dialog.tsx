/**
 * Settings Dialog
 * Main settings/preferences dialog for the Git Graph application
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/trpc/client';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
	const utils = trpc.useUtils();
	const { data: config } = trpc.config.getAll.useQuery(undefined, { enabled: open });

	// Graph settings
	const [graphColors, setGraphColors] = useState<string>('');
	const [graphStyle, setGraphStyle] = useState<'rounded' | 'angular'>('rounded');

	// Date settings
	const [dateFormat, setDateFormat] = useState<string>('dateAndTime');
	const [dateType, setDateType] = useState<string>('author');

	// Repository settings
	const [initialLoadCommits, setInitialLoadCommits] = useState(300);
	const [showRemoteBranches, setShowRemoteBranches] = useState(true);
	const [showStashes, setShowStashes] = useState(true);
	const [showTags, setShowTags] = useState(true);
	const [showUncommittedChanges, setShowUncommittedChanges] = useState(true);
	const [muteMergeCommits, setMuteMergeCommits] = useState(true);
	const [onlyFollowFirstParent, setOnlyFollowFirstParent] = useState(false);

	// Dialog settings
	const [resetCommitMode, setResetCommitMode] = useState<'soft' | 'mixed' | 'hard'>('mixed');
	const [createBranchCheckout, setCreateBranchCheckout] = useState(false);
	const [mergeNoFastForward, setMergeNoFastForward] = useState(true);
	const [rebaseInteractive, setRebaseInteractive] = useState(false);
	const [addTagType, setAddTagType] = useState<'annotated' | 'lightweight'>('annotated');

	// UI settings
	const [enhancedAccessibility, setEnhancedAccessibility] = useState(false);
	const [markdown, setMarkdown] = useState(true);

	// Load config into state
	useEffect(() => {
		if (config) {
			const graphConfig = config.graph as Record<string, unknown> | undefined;
			const dateConfig = config.date as Record<string, unknown> | undefined;
			const repoConfig = config.repository as Record<string, unknown> | undefined;
			const dialogConfig = config.dialog as Record<string, unknown> | undefined;
			const uiConfig = config.ui as Record<string, unknown> | undefined;
			
			const colours = graphConfig?.colours;
			setGraphColors(Array.isArray(colours) ? colours.join('\n') : '');
			setGraphStyle((graphConfig?.style as 'rounded' | 'angular') ?? 'rounded');
			setDateFormat((dateConfig?.format as string) ?? 'dateAndTime');
			setDateType((dateConfig?.type as string) ?? 'author');
			setInitialLoadCommits((repoConfig?.initialLoadCommits as number) ?? 300);
			setShowRemoteBranches((repoConfig?.showRemoteBranches as boolean) ?? true);
			setShowStashes((repoConfig?.showStashes as boolean) ?? true);
			setShowTags((repoConfig?.showTags as boolean) ?? true);
			setShowUncommittedChanges((repoConfig?.showUncommittedChanges as boolean) ?? true);
			setMuteMergeCommits((repoConfig?.muteMergeCommits as boolean) ?? true);
			setOnlyFollowFirstParent((repoConfig?.onlyFollowFirstParent as boolean) ?? false);
			setResetCommitMode((dialogConfig?.resetCommitMode as 'soft' | 'mixed' | 'hard') ?? 'mixed');
			setCreateBranchCheckout((dialogConfig?.createBranchCheckout as boolean) ?? false);
			setMergeNoFastForward((dialogConfig?.mergeNoFastForward as boolean) ?? true);
			setRebaseInteractive((dialogConfig?.rebaseInteractive as boolean) ?? false);
			setAddTagType((dialogConfig?.addTagType as 'annotated' | 'lightweight') ?? 'annotated');
			setEnhancedAccessibility((uiConfig?.enhancedAccessibility as boolean) ?? false);
			setMarkdown((uiConfig?.markdown as boolean) ?? true);
		}
	}, [config]);

	const saveGraphMutation = trpc.config.setGraph.useMutation({
		onSuccess: () => utils.config.getAll.invalidate(),
	});

	const saveDateMutation = trpc.config.setDate.useMutation({
		onSuccess: () => utils.config.getAll.invalidate(),
	});

	const saveRepositoryMutation = trpc.config.setRepository.useMutation({
		onSuccess: () => utils.config.getAll.invalidate(),
	});

	const saveDialogMutation = trpc.config.setDialog.useMutation({
		onSuccess: () => utils.config.getAll.invalidate(),
	});

	const saveUiMutation = trpc.config.setUi.useMutation({
		onSuccess: () => utils.config.getAll.invalidate(),
	});

	const handleSaveGraph = () => {
		saveGraphMutation.mutate({
			colours: graphColors.split('\n').filter((c) => c.trim()),
			style: graphStyle,
		});
	};

	const handleSaveDate = () => {
		saveDateMutation.mutate({
			format: dateFormat as 'dateAndTime' | 'dateOnly' | 'relative' | 'isoDateAndTime' | 'isoDateOnly',
			type: dateType as 'author' | 'commit',
		});
	};

	const handleSaveRepository = () => {
		saveRepositoryMutation.mutate({
			initialLoadCommits,
			showRemoteBranches,
			showStashes,
			showTags,
			showUncommittedChanges,
			muteMergeCommits,
			onlyFollowFirstParent,
		});
	};

	const handleSaveDialog = () => {
		saveDialogMutation.mutate({
			resetCommitMode,
			createBranchCheckout,
			mergeNoFastForward,
			rebaseInteractive,
			addTagType,
		});
	};

	const handleSaveUi = () => {
		saveUiMutation.mutate({
			enhancedAccessibility,
			markdown,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] ui-surface">
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
				</DialogHeader>

				<Tabs defaultValue="general" className="w-full">
					<TabsList className="grid grid-cols-4 w-full">
						<TabsTrigger value="general">General</TabsTrigger>
						<TabsTrigger value="graph">Graph</TabsTrigger>
						<TabsTrigger value="repository">Repository</TabsTrigger>
						<TabsTrigger value="dialogs">Dialogs</TabsTrigger>
					</TabsList>

					<ScrollArea className="h-[50vh] mt-4">
						<TabsContent value="general" className="space-y-4 p-4">
							<Card>
								<CardHeader>
									<CardTitle>Date Format</CardTitle>
									<CardDescription>Configure how dates are displayed</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label>Format</Label>
											<Select value={dateFormat} onValueChange={(v) => v && setDateFormat(v)}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="dateAndTime">Date & Time</SelectItem>
													<SelectItem value="dateOnly">Date Only</SelectItem>
													<SelectItem value="relative">Relative</SelectItem>
													<SelectItem value="isoDateAndTime">ISO Date & Time</SelectItem>
													<SelectItem value="isoDateOnly">ISO Date Only</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label>Date Type</Label>
											<Select value={dateType} onValueChange={(v) => v && setDateType(v)}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="author">Author Date</SelectItem>
													<SelectItem value="commit">Commit Date</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
									<Button onClick={handleSaveDate} disabled={saveDateMutation.isPending}>
										Save Date Settings
									</Button>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Accessibility</CardTitle>
									<CardDescription>Accessibility and display options</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center justify-between">
										<div className="space-y-0.5">
											<Label>Enhanced Accessibility</Label>
											<p className="text-sm text-muted-foreground">Enable enhanced accessibility features</p>
										</div>
										<Switch checked={enhancedAccessibility} onCheckedChange={setEnhancedAccessibility} />
									</div>
									<Separator />
									<div className="flex items-center justify-between">
										<div className="space-y-0.5">
											<Label>Render Markdown</Label>
											<p className="text-sm text-muted-foreground">Render markdown in commit messages</p>
										</div>
										<Switch checked={markdown} onCheckedChange={setMarkdown} />
									</div>
									<Button onClick={handleSaveUi} disabled={saveUiMutation.isPending}>
										Save UI Settings
									</Button>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="graph" className="space-y-4 p-4">
							<Card>
								<CardHeader>
									<CardTitle>Graph Appearance</CardTitle>
									<CardDescription>Customize the visual style of the commit graph</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label>Graph Style</Label>
										<Select value={graphStyle} onValueChange={(v) => setGraphStyle(v as 'rounded' | 'angular')}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="rounded">Rounded</SelectItem>
												<SelectItem value="angular">Angular</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Branch Colors (one per line, hex format)</Label>
										<textarea
											className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
											value={graphColors}
											onChange={(e) => setGraphColors(e.target.value)}
											placeholder="#0085d9&#10;#d9008f&#10;#00d90a"
										/>
									</div>

									<Button onClick={handleSaveGraph} disabled={saveGraphMutation.isPending}>
										Save Graph Settings
									</Button>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="repository" className="space-y-4 p-4">
							<Card>
								<CardHeader>
									<CardTitle>Repository Display</CardTitle>
									<CardDescription>Configure what is shown in the repository view</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label>Initial Commits to Load</Label>
										<Input
											type="number"
											value={initialLoadCommits}
											onChange={(e) => setInitialLoadCommits(parseInt(e.target.value) || 300)}
											min={50}
											max={1000}
										/>
									</div>

									<Separator />

									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<Label>Show Remote Branches</Label>
											<Switch checked={showRemoteBranches} onCheckedChange={setShowRemoteBranches} />
										</div>
										<div className="flex items-center justify-between">
											<Label>Show Stashes</Label>
											<Switch checked={showStashes} onCheckedChange={setShowStashes} />
										</div>
										<div className="flex items-center justify-between">
											<Label>Show Tags</Label>
											<Switch checked={showTags} onCheckedChange={setShowTags} />
										</div>
										<div className="flex items-center justify-between">
											<Label>Show Uncommitted Changes</Label>
											<Switch checked={showUncommittedChanges} onCheckedChange={setShowUncommittedChanges} />
										</div>
										<div className="flex items-center justify-between">
											<Label>Mute Merge Commits</Label>
											<Switch checked={muteMergeCommits} onCheckedChange={setMuteMergeCommits} />
										</div>
										<div className="flex items-center justify-between">
											<Label>Only Follow First Parent</Label>
											<Switch checked={onlyFollowFirstParent} onCheckedChange={setOnlyFollowFirstParent} />
										</div>
									</div>

									<Button onClick={handleSaveRepository} disabled={saveRepositoryMutation.isPending}>
										Save Repository Settings
									</Button>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="dialogs" className="space-y-4 p-4">
							<Card>
								<CardHeader>
									<CardTitle>Dialog Defaults</CardTitle>
									<CardDescription>Set default values for dialog options</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label>Reset Mode</Label>
										<Select value={resetCommitMode} onValueChange={(v) => setResetCommitMode(v as 'soft' | 'mixed' | 'hard')}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="soft">Soft</SelectItem>
												<SelectItem value="mixed">Mixed</SelectItem>
												<SelectItem value="hard">Hard</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label>Add Tag Type</Label>
										<Select value={addTagType} onValueChange={(v) => setAddTagType(v as 'annotated' | 'lightweight')}>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="annotated">Annotated</SelectItem>
												<SelectItem value="lightweight">Lightweight</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<Separator />

									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<Label>Checkout after creating branch</Label>
											<Switch checked={createBranchCheckout} onCheckedChange={setCreateBranchCheckout} />
										</div>
										<div className="flex items-center justify-between">
											<Label>No fast-forward merge by default</Label>
											<Switch checked={mergeNoFastForward} onCheckedChange={setMergeNoFastForward} />
										</div>
										<div className="flex items-center justify-between">
											<Label>Interactive rebase by default</Label>
											<Switch checked={rebaseInteractive} onCheckedChange={setRebaseInteractive} />
										</div>
									</div>

									<Button onClick={handleSaveDialog} disabled={saveDialogMutation.isPending}>
										Save Dialog Settings
									</Button>
								</CardContent>
							</Card>
						</TabsContent>
					</ScrollArea>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
