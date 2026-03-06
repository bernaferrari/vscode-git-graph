/**
 * Settings Dialog
 * Main settings/preferences dialog for the Git Graph application
 */

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/trpc/client';

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type GraphStyle = 'rounded' | 'angular';
type DateFormat = 'dateAndTime' | 'dateOnly' | 'relative' | 'isoDateAndTime' | 'isoDateOnly';
type DateType = 'author' | 'commit';
type ResetCommitMode = 'soft' | 'mixed' | 'hard';
type AddTagType = 'annotated' | 'lightweight';

interface ConfigAllData {
	graph?: unknown;
	date?: unknown;
	repository?: unknown;
	dialog?: unknown;
	ui?: unknown;
}

interface QueryOptions {
	enabled: boolean;
}

interface QueryState<TData> {
	data?: TData;
}

interface MutationCallbacks {
	onSuccess?: () => void;
}

interface MutationState<TInput> {
	mutate: (input: TInput) => void;
	isPending: boolean;
}

interface InvalidateTarget {
	invalidate: () => Promise<unknown>;
}

interface TrpcUtilsShape {
	config: {
		getAll: InvalidateTarget;
	};
}

interface TrpcConfigShape {
	getAll: {
		useQuery: (input: undefined, options: QueryOptions) => QueryState<ConfigAllData>;
	};
	setGraph: {
		useMutation: (callbacks: MutationCallbacks) => MutationState<{ colours: string[]; style: GraphStyle }>;
	};
	setDate: {
		useMutation: (callbacks: MutationCallbacks) => MutationState<{ format: DateFormat; type: DateType }>;
	};
	setRepository: {
		useMutation: (callbacks: MutationCallbacks) => MutationState<{
			initialLoadCommits: number;
			showRemoteBranches: boolean;
			showStashes: boolean;
			showTags: boolean;
			showUncommittedChanges: boolean;
			muteMergeCommits: boolean;
			onlyFollowFirstParent: boolean;
		}>;
	};
	setDialog: {
		useMutation: (callbacks: MutationCallbacks) => MutationState<{
			resetCommitMode: ResetCommitMode;
			createBranchCheckout: boolean;
			mergeNoFastForward: boolean;
			rebaseInteractive: boolean;
			addTagType: AddTagType;
		}>;
	};
	setUi: {
		useMutation: (callbacks: MutationCallbacks) => MutationState<{
			enhancedAccessibility: boolean;
			markdown: boolean;
		}>;
	};
}

interface TrpcClientShape {
	useUtils: () => TrpcUtilsShape;
	config: TrpcConfigShape;
}

function toRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown> | null, key: string, fallback: string): string {
	if (!record) return fallback;
	const value = record[key];
	return typeof value === 'string' ? value : fallback;
}

function readBoolean(record: Record<string, unknown> | null, key: string, fallback: boolean): boolean {
	if (!record) return fallback;
	const value = record[key];
	return typeof value === 'boolean' ? value : fallback;
}

function readNumber(record: Record<string, unknown> | null, key: string, fallback: number): number {
	if (!record) return fallback;
	const value = record[key];
	return typeof value === 'number' ? value : fallback;
}

function readColours(record: Record<string, unknown> | null): string[] {
	if (!record) return [];
	const colours = record.colours;
	if (!Array.isArray(colours)) return [];
	return colours.filter((entry): entry is string => typeof entry === 'string');
}

function readGraphStyle(record: Record<string, unknown> | null, fallback: GraphStyle): GraphStyle {
	const value = readString(record, 'style', fallback);
	return value === 'rounded' || value === 'angular' ? value : fallback;
}

function readResetCommitMode(record: Record<string, unknown> | null, fallback: ResetCommitMode): ResetCommitMode {
	const value = readString(record, 'resetCommitMode', fallback);
	return value === 'soft' || value === 'mixed' || value === 'hard' ? value : fallback;
}

function readAddTagType(record: Record<string, unknown> | null, fallback: AddTagType): AddTagType {
	const value = readString(record, 'addTagType', fallback);
	return value === 'annotated' || value === 'lightweight' ? value : fallback;
}

function toDateFormat(value: string): DateFormat {
	if (
		value === 'dateAndTime' ||
		value === 'dateOnly' ||
		value === 'relative' ||
		value === 'isoDateAndTime' ||
		value === 'isoDateOnly'
	) {
		return value;
	}
	return 'dateAndTime';
}

function toDateType(value: string): DateType {
	return value === 'commit' ? 'commit' : 'author';
}

function toGraphStyle(value: string): GraphStyle {
	return value === 'angular' ? 'angular' : 'rounded';
}

function toResetCommitMode(value: string): ResetCommitMode {
	if (value === 'soft' || value === 'mixed' || value === 'hard') {
		return value;
	}
	return 'mixed';
}

function toAddTagType(value: string): AddTagType {
	return value === 'lightweight' ? 'lightweight' : 'annotated';
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
	const typedTrpc = trpc as unknown as TrpcClientShape;
	const utils = typedTrpc.useUtils();
	const { data: config } = typedTrpc.config.getAll.useQuery(undefined, { enabled: open });

	// Graph settings
	const [graphColors, setGraphColors] = useState<string>('');
	const [graphStyle, setGraphStyle] = useState<GraphStyle>('rounded');

	// Date settings
	const [dateFormat, setDateFormat] = useState<DateFormat>('dateAndTime');
	const [dateType, setDateType] = useState<DateType>('author');

	// Repository settings
	const [initialLoadCommits, setInitialLoadCommits] = useState(300);
	const [showRemoteBranches, setShowRemoteBranches] = useState(true);
	const [showStashes, setShowStashes] = useState(true);
	const [showTags, setShowTags] = useState(true);
	const [showUncommittedChanges, setShowUncommittedChanges] = useState(true);
	const [muteMergeCommits, setMuteMergeCommits] = useState(true);
	const [onlyFollowFirstParent, setOnlyFollowFirstParent] = useState(false);

	// Dialog settings
	const [resetCommitMode, setResetCommitMode] = useState<ResetCommitMode>('mixed');
	const [createBranchCheckout, setCreateBranchCheckout] = useState(false);
	const [mergeNoFastForward, setMergeNoFastForward] = useState(true);
	const [rebaseInteractive, setRebaseInteractive] = useState(false);
	const [addTagType, setAddTagType] = useState<AddTagType>('annotated');

	// UI settings
	const [enhancedAccessibility, setEnhancedAccessibility] = useState(false);
	const [markdown, setMarkdown] = useState(true);

	// Load config into state
	useEffect(() => {
		if (config) {
			const graphConfig = toRecord(config.graph);
			const dateConfig = toRecord(config.date);
			const repoConfig = toRecord(config.repository);
			const dialogConfig = toRecord(config.dialog);
			const uiConfig = toRecord(config.ui);
			
			setGraphColors(readColours(graphConfig).join('\n'));
			setGraphStyle(readGraphStyle(graphConfig, 'rounded'));
			setDateFormat(toDateFormat(readString(dateConfig, 'format', 'dateAndTime')));
			setDateType(toDateType(readString(dateConfig, 'type', 'author')));
			setInitialLoadCommits(readNumber(repoConfig, 'initialLoadCommits', 300));
			setShowRemoteBranches(readBoolean(repoConfig, 'showRemoteBranches', true));
			setShowStashes(readBoolean(repoConfig, 'showStashes', true));
			setShowTags(readBoolean(repoConfig, 'showTags', true));
			setShowUncommittedChanges(readBoolean(repoConfig, 'showUncommittedChanges', true));
			setMuteMergeCommits(readBoolean(repoConfig, 'muteMergeCommits', true));
			setOnlyFollowFirstParent(readBoolean(repoConfig, 'onlyFollowFirstParent', false));
			setResetCommitMode(readResetCommitMode(dialogConfig, 'mixed'));
			setCreateBranchCheckout(readBoolean(dialogConfig, 'createBranchCheckout', false));
			setMergeNoFastForward(readBoolean(dialogConfig, 'mergeNoFastForward', true));
			setRebaseInteractive(readBoolean(dialogConfig, 'rebaseInteractive', false));
			setAddTagType(readAddTagType(dialogConfig, 'annotated'));
			setEnhancedAccessibility(readBoolean(uiConfig, 'enhancedAccessibility', false));
			setMarkdown(readBoolean(uiConfig, 'markdown', true));
		}
	}, [config]);

	const saveGraphMutation = typedTrpc.config.setGraph.useMutation({
		onSuccess: () => {
			void utils.config.getAll.invalidate();
		},
	});

	const saveDateMutation = typedTrpc.config.setDate.useMutation({
		onSuccess: () => {
			void utils.config.getAll.invalidate();
		},
	});

	const saveRepositoryMutation = typedTrpc.config.setRepository.useMutation({
		onSuccess: () => {
			void utils.config.getAll.invalidate();
		},
	});

	const saveDialogMutation = typedTrpc.config.setDialog.useMutation({
		onSuccess: () => {
			void utils.config.getAll.invalidate();
		},
	});

	const saveUiMutation = typedTrpc.config.setUi.useMutation({
		onSuccess: () => {
			void utils.config.getAll.invalidate();
		},
	});

	const handleSaveGraph = () => {
		saveGraphMutation.mutate({
			colours: graphColors.split('\n').filter((c) => c.trim()),
			style: graphStyle,
		});
	};

	const handleSaveDate = () => {
		saveDateMutation.mutate({
			format: dateFormat,
			type: dateType,
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
											<Select
												value={dateFormat}
												onValueChange={(value) => {
													setDateFormat(toDateFormat(value));
												}}>
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
											<Select
												value={dateType}
												onValueChange={(value) => {
													setDateType(toDateType(value));
												}}>
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
										<Select
											value={graphStyle}
											onValueChange={(value) => {
												setGraphStyle(toGraphStyle(value));
											}}>
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
											onChange={(e) => { setGraphColors(e.target.value); }}
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
											onChange={(e) => { setInitialLoadCommits(parseInt(e.target.value) || 300); }}
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
										<Select
											value={resetCommitMode}
											onValueChange={(value) => {
												setResetCommitMode(toResetCommitMode(value));
											}}>
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
										<Select
											value={addTagType}
											onValueChange={(value) => {
												setAddTagType(toAddTagType(value));
											}}>
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
