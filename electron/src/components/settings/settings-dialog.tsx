/**
 * Settings Dialog
 * Main settings/preferences dialog for the Git Graph application
 */

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/trpc/client';

const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85';
const SECTION_DESC = 'text-[11px] text-muted-foreground/85 leading-relaxed';
const FIELD_LABEL = 'text-[0.8125rem] font-medium text-foreground/90';
const FIELD_HINT = 'text-[11px] text-muted-foreground/85 leading-snug';

interface SectionProps {
	title: string;
	description?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
}

function Section({ title, description, children, footer }: SectionProps) {
	return (
		<section className='space-y-2.5 rounded-xl border border-border/70 bg-card/40 p-3.5'>
			<header className='space-y-0.5'>
				<h3 className={SECTION_LABEL}>{title}</h3>
				{description ? <p className={SECTION_DESC}>{description}</p> : null}
			</header>
			<div className='space-y-2.5'>{children}</div>
			{footer ? <div className='pt-1.5'>{footer}</div> : null}
		</section>
	);
}

function ToggleRow({
	label,
	description,
	checked,
	onCheckedChange,
}: {
	label: string;
	description?: string;
	checked: boolean;
	onCheckedChange: (next: boolean) => void;
}) {
	return (
		<div className='flex min-h-7 items-center justify-between gap-3'>
			<div className='min-w-0 space-y-0.5'>
				<Label className={FIELD_LABEL}>{label}</Label>
				{description ? <p className={FIELD_HINT}>{description}</p> : null}
			</div>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

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

function toDateFormat(value: string | null): DateFormat {
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

function toDateType(value: string | null): DateType {
	return value === 'commit' ? 'commit' : 'author';
}

function toGraphStyle(value: string | null): GraphStyle {
	return value === 'angular' ? 'angular' : 'rounded';
}

function toResetCommitMode(value: string | null): ResetCommitMode {
	if (value === 'soft' || value === 'mixed' || value === 'hard') {
		return value;
	}
	return 'mixed';
}

function toAddTagType(value: string | null): AddTagType {
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
			<DialogContent className='max-w-2xl max-h-[82vh] sm:max-w-2xl'>
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
				</DialogHeader>

				<Tabs defaultValue='general' className='w-full'>
					<TabsList className='grid grid-cols-4 w-full'>
						<TabsTrigger value='general'>General</TabsTrigger>
						<TabsTrigger value='graph'>Graph</TabsTrigger>
						<TabsTrigger value='repository'>Repository</TabsTrigger>
						<TabsTrigger value='dialogs'>Dialogs</TabsTrigger>
					</TabsList>

					<ScrollArea className='h-[55vh] mt-3 -mx-1'>
						<TabsContent value='general' className='space-y-3 px-1 py-1'>
							<Section
								title='Date format'
								description='How commit dates appear throughout the app.'
								footer={
									<Button size='sm' onClick={handleSaveDate} disabled={saveDateMutation.isPending}>
										Save date settings
									</Button>
								}>
								<div className='grid grid-cols-2 gap-3'>
									<div className='space-y-1.5'>
										<Label className={FIELD_LABEL}>Format</Label>
										<Select
											value={dateFormat}
											onValueChange={(value) => { setDateFormat(toDateFormat(value)); }}>
											<SelectTrigger className='w-full'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='dateAndTime'>Date & time</SelectItem>
												<SelectItem value='dateOnly'>Date only</SelectItem>
												<SelectItem value='relative'>Relative</SelectItem>
												<SelectItem value='isoDateAndTime'>ISO date & time</SelectItem>
												<SelectItem value='isoDateOnly'>ISO date only</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className='space-y-1.5'>
										<Label className={FIELD_LABEL}>Source</Label>
										<Select
											value={dateType}
											onValueChange={(value) => { setDateType(toDateType(value)); }}>
											<SelectTrigger className='w-full'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='author'>Author date</SelectItem>
												<SelectItem value='commit'>Commit date</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</Section>

							<Section
								title='Accessibility'
								description='Accessibility and display options.'
								footer={
									<Button size='sm' onClick={handleSaveUi} disabled={saveUiMutation.isPending}>
										Save UI settings
									</Button>
								}>
								<ToggleRow
									label='Enhanced accessibility'
									description='Increase contrast and disable backdrop blur.'
									checked={enhancedAccessibility}
									onCheckedChange={setEnhancedAccessibility}
								/>
								<ToggleRow
									label='Render markdown'
									description='Render markdown in commit messages and PR bodies.'
									checked={markdown}
									onCheckedChange={setMarkdown}
								/>
							</Section>
						</TabsContent>

						<TabsContent value='graph' className='space-y-3 px-1 py-1'>
							<Section
								title='Graph appearance'
								description='Customize the visual style of the commit graph.'
								footer={
									<Button size='sm' onClick={handleSaveGraph} disabled={saveGraphMutation.isPending}>
										Save graph settings
									</Button>
								}>
								<div className='space-y-1.5'>
									<Label className={FIELD_LABEL}>Style</Label>
									<Select
										value={graphStyle}
										onValueChange={(value) => { setGraphStyle(toGraphStyle(value)); }}>
										<SelectTrigger className='w-full'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='rounded'>Rounded</SelectItem>
											<SelectItem value='angular'>Angular</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className='space-y-1.5'>
									<Label className={FIELD_LABEL}>Branch colors</Label>
									<p className={FIELD_HINT}>One hex color per line. Falls back to the chart palette when empty.</p>
									<textarea
										className='flex min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-[0.8125rem] font-mono placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45'
										value={graphColors}
										onChange={(e) => { setGraphColors(e.target.value); }}
										placeholder='#0085d9&#10;#d9008f&#10;#00d90a'
									/>
								</div>
							</Section>
						</TabsContent>

						<TabsContent value='repository' className='space-y-3 px-1 py-1'>
							<Section
								title='Repository display'
								description='What appears in the repository view.'
								footer={
									<Button size='sm' onClick={handleSaveRepository} disabled={saveRepositoryMutation.isPending}>
										Save repository settings
									</Button>
								}>
								<div className='space-y-1.5'>
									<Label className={FIELD_LABEL}>Initial commits to load</Label>
									<Input
										type='number'
										value={initialLoadCommits}
										onChange={(e) => { setInitialLoadCommits(parseInt(e.target.value) || 300); }}
										min={50}
										max={1000}
										className='font-mono tabular-nums w-32'
									/>
								</div>

								<div className='-mx-3.5 my-1 h-px bg-border/60' />

								<ToggleRow label='Show remote branches' checked={showRemoteBranches} onCheckedChange={setShowRemoteBranches} />
								<ToggleRow label='Show stashes' checked={showStashes} onCheckedChange={setShowStashes} />
								<ToggleRow label='Show tags' checked={showTags} onCheckedChange={setShowTags} />
								<ToggleRow label='Show uncommitted changes' checked={showUncommittedChanges} onCheckedChange={setShowUncommittedChanges} />
								<ToggleRow label='Mute merge commits' description='Render merge commits at lower opacity.' checked={muteMergeCommits} onCheckedChange={setMuteMergeCommits} />
								<ToggleRow label='Only follow first parent' checked={onlyFollowFirstParent} onCheckedChange={setOnlyFollowFirstParent} />
							</Section>
						</TabsContent>

						<TabsContent value='dialogs' className='space-y-3 px-1 py-1'>
							<Section
								title='Dialog defaults'
								description='Default values used when opening common dialogs.'
								footer={
									<Button size='sm' onClick={handleSaveDialog} disabled={saveDialogMutation.isPending}>
										Save dialog settings
									</Button>
								}>
								<div className='grid grid-cols-2 gap-3'>
									<div className='space-y-1.5'>
										<Label className={FIELD_LABEL}>Reset mode</Label>
										<Select
											value={resetCommitMode}
											onValueChange={(value) => { setResetCommitMode(toResetCommitMode(value)); }}>
											<SelectTrigger className='w-full'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='soft'>Soft</SelectItem>
												<SelectItem value='mixed'>Mixed</SelectItem>
												<SelectItem value='hard'>Hard</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className='space-y-1.5'>
										<Label className={FIELD_LABEL}>Tag type</Label>
										<Select
											value={addTagType}
											onValueChange={(value) => { setAddTagType(toAddTagType(value)); }}>
											<SelectTrigger className='w-full'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='annotated'>Annotated</SelectItem>
												<SelectItem value='lightweight'>Lightweight</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								<div className='-mx-3.5 my-1 h-px bg-border/60' />

								<ToggleRow label='Checkout after creating branch' checked={createBranchCheckout} onCheckedChange={setCreateBranchCheckout} />
								<ToggleRow label='No fast-forward merge by default' checked={mergeNoFastForward} onCheckedChange={setMergeNoFastForward} />
								<ToggleRow label='Interactive rebase by default' checked={rebaseInteractive} onCheckedChange={setRebaseInteractive} />
							</Section>
						</TabsContent>
					</ScrollArea>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
