import { formatDistanceToNow } from 'date-fns';
import {
	AlertCircle,
	ArrowDownToLine,
	ArrowUpToLine,
	CheckCircle2,
	Copy,
	Link2,
	RefreshCw,
	Server,
	Trash2,
	Upload,
	Users,
} from 'lucide-react';

import { CollaborationAssignmentPanel } from '@/components/git-graph/collaboration-center-assignment';
import { CollaborationCommentThread } from '@/components/git-graph/collaboration-comment-thread';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type {
	CollaborationAssignment,
	CollaborationComment,
	CollaborationMemberProfile,
} from '@/components/git-graph/collaboration-types';

export interface SyncConfigState {
	enabled: boolean;
	provider: 'self-host';
	endpointUrl: string;
	projectId: string;
	authToken: string;
	memberId: string;
	memberApiKey: string;
	displayName: string;
	email: string;
	role: 'developer' | 'reviewer' | 'lead' | 'qa';
	permissionLevel: 'owner' | 'manager' | 'member' | 'observer';
	organizationId: string;
	organizationName: string;
	teamId: string;
	teamName: string;
	avatarUrl: string;
	deviceLabel: string;
	presenceEnabled: boolean;
	liveSyncEnabled: boolean;
	realtimeEnabled: boolean;
	timeoutMs: number;
	autoSyncOnOpen: boolean;
	lastSyncedAt: number | null;
	lastSyncStatus: 'idle' | 'syncing' | 'success' | 'error';
	lastSyncError: string | null;
}

export interface CollaborationActivityEntry {
	id: string;
	timestamp: number;
	type: 'workspace-share' | 'patch-share' | 'bundle-export' | 'bundle-import' | 'remote-sync' | 'comment' | 'assignment';
	action: 'created' | 'deleted' | 'exported' | 'imported' | 'pushed' | 'pulled' | 'roundtrip' | 'failed' | 'updated';
	status: 'success' | 'failed' | 'info';
	title: string;
	description?: string;
	metadata?: Record<string, unknown>;
	actor?: string;
}

export interface CollaborationRemoteHealth {
	ok: boolean;
	serverTime?: string;
	projectCount?: number;
	storagePath?: string;
	version?: string;
}

export interface CollaborationWorkspaceShareRepo {
	path: string;
	name: string;
	head: string | null;
	needsAttention: boolean;
	deepLink: string;
}

export interface CollaborationWorkspaceShare {
	id: string;
	workspaceId: string;
	name: string;
	note: string;
	createdAt: number;
	repos: CollaborationWorkspaceShareRepo[];
}

export interface CollaborationPatchShare {
	id: string;
	repo: string;
	name: string;
	baseRef: string;
	headRef: string;
	summary: string;
	patch: string;
	fileCount: number;
	additions: number;
	deletions: number;
}

export interface CollaborationWorkspaceOption {
	id: string;
	name: string;
}

function formatSyncTimestamp(timestamp: number | null): string {
	if (!timestamp) {
		return 'Never synced';
	}
	return new Date(timestamp).toLocaleString();
}

function SummaryCard({
	title,
	value,
	description,
	tone = 'default',
}: {
	title: string;
	value: string;
	description: string;
	tone?: 'default' | 'success' | 'attention';
}) {
	const accentClassName =
		tone === 'success'
			? 'from-emerald-500/16 to-teal-500/8'
			: tone === 'attention'
				? 'from-amber-500/16 to-orange-500/8'
				: 'from-sky-500/12 to-transparent';

	return (
		<Card className={`relative overflow-hidden border-border/70 bg-gradient-to-br ${accentClassName}`}>
			<CardHeader className='space-y-1 pb-2'>
				<CardDescription className='text-[11px] uppercase tracking-[0.18em]'>{title}</CardDescription>
				<CardTitle className='text-2xl font-semibold tabular-nums'>{value}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className='text-muted-foreground text-xs leading-5'>{description}</p>
			</CardContent>
		</Card>
	);
}

export function CollaborationSummaryStrip({
	workspaceShares,
	patchShelf,
	syncConfig,
}: {
	workspaceShares: CollaborationWorkspaceShare[];
	patchShelf: CollaborationPatchShare[];
	syncConfig: SyncConfigState;
}) {
	const syncTone =
		syncConfig.lastSyncStatus === 'success'
			? 'success'
			: syncConfig.lastSyncStatus === 'error'
				? 'attention'
				: 'default';

	return (
		<div className='border-border/60 bg-muted/20 border-b px-5 py-4'>
			<div className='grid gap-3 md:grid-cols-3'>
				<SummaryCard
					title='Handoffs'
					value={String(workspaceShares.length)}
					description='Captured workspace transitions with repo context and deep links.'
					tone={workspaceShares.length > 0 ? 'success' : 'default'}
				/>
				<SummaryCard
					title='Patch Shelf'
					value={String(patchShelf.length)}
					description='Reusable binary patches ready to copy, pull, or hand off.'
					tone={patchShelf.length > 0 ? 'success' : 'default'}
				/>
				<SummaryCard
					title='Sync'
					value={syncConfig.enabled ? (syncConfig.lastSyncStatus === 'success' ? 'Connected' : syncConfig.lastSyncStatus === 'error' ? 'Blocked' : 'Ready') : 'Local'}
					description={
						syncConfig.enabled
							? `${syncConfig.projectId} · ${formatSyncTimestamp(syncConfig.lastSyncedAt)}`
							: 'Keep collaboration local or connect a self-host endpoint.'
					}
					tone={syncTone}
				/>
			</div>
		</div>
	);
}

export function WorkspaceHandoffsTab({
	workspaces,
	selectedWorkspaceId,
	workspaceShareName,
	workspaceShareNote,
	workspaceShares,
	commentDrafts,
	assignmentDrafts,
	commentMutating,
	assignmentMutating,
	commentsByTarget,
	assignmentsByTarget,
	memberOptions,
	createPending,
	selectedWorkspaceAvailable,
	onWorkspaceChange,
	onShareNameChange,
	onShareNoteChange,
	onCreate,
	onDelete,
	onCopyLink,
	onCommentDraftChange,
	onCommentSubmit,
	onCommentDelete,
	onAssignmentAssigneeChange,
	onAssignmentNoteChange,
	onAssignmentCreate,
	onAssignmentStatusChange,
	onAssignmentDelete,
}: {
	workspaces: CollaborationWorkspaceOption[];
	selectedWorkspaceId: string;
	workspaceShareName: string;
	workspaceShareNote: string;
	workspaceShares: CollaborationWorkspaceShare[];
	commentDrafts: Record<string, string>;
	assignmentDrafts: Record<string, { assigneeId: string; note: string }>;
	commentMutating: boolean;
	assignmentMutating: boolean;
	commentsByTarget: Record<string, CollaborationComment[]>;
	assignmentsByTarget: Record<string, CollaborationAssignment[]>;
	memberOptions: CollaborationMemberProfile[];
	createPending: boolean;
	selectedWorkspaceAvailable: boolean;
	onWorkspaceChange: (value: string) => void;
	onShareNameChange: (value: string) => void;
	onShareNoteChange: (value: string) => void;
	onCreate: () => void;
	onDelete: (id: string) => void;
	onCopyLink: (value: string) => void;
	onCommentDraftChange: (targetKey: string, value: string) => void;
	onCommentSubmit: (targetType: 'workspace-share' | 'patch-share', targetId: string) => void;
	onCommentDelete: (id: string) => void;
	onAssignmentAssigneeChange: (targetKey: string, value: string) => void;
	onAssignmentNoteChange: (targetKey: string, value: string) => void;
	onAssignmentCreate: (targetType: 'workspace-share' | 'patch-share', targetId: string) => void;
	onAssignmentStatusChange: (assignmentId: string, status: CollaborationAssignment['status']) => void;
	onAssignmentDelete: (id: string) => void;
}) {
	return (
		<TabsContent value='handoffs' className='m-0 min-h-0 flex-1 overflow-hidden'>
			<ScrollArea className='h-full'>
				<div className='grid gap-5 p-5 lg:grid-cols-[0.92fr_1.08fr]'>
					<Card className='border-border/70'>
						<CardHeader>
							<CardTitle className='text-sm'>Create Workspace Handoff</CardTitle>
							<CardDescription>
								Snapshot repo context, current branches, and deep links for a clean engineer handoff.
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-3'>
							<label className='block text-xs font-medium'>
								<span className='mb-1 block text-muted-foreground'>Workspace</span>
								<select
									className='border-border bg-background h-11 w-full rounded-md border px-3 text-sm'
									value={selectedWorkspaceId}
									onChange={(event) => { onWorkspaceChange(event.target.value); }}>
									{workspaces.map((workspace) => (
										<option key={workspace.id} value={workspace.id}>
											{workspace.name}
										</option>
									))}
								</select>
							</label>
							<label className='block text-xs font-medium'>
								<span className='mb-1 block text-muted-foreground'>Share name</span>
								<Input value={workspaceShareName} onChange={(event) => { onShareNameChange(event.target.value); }} />
							</label>
							<label className='block text-xs font-medium'>
								<span className='mb-1 block text-muted-foreground'>Note</span>
								<Textarea
									value={workspaceShareNote}
									onChange={(event) => { onShareNoteChange(event.target.value); }}
									placeholder='Context for reviewers, QA, or the next engineer'
									className='min-h-28 resize-none'
								/>
							</label>
							<Button className='h-11 w-full' onClick={onCreate} disabled={!selectedWorkspaceAvailable || createPending}>
								Create Handoff
							</Button>
						</CardContent>
					</Card>

					<div className='space-y-3'>
						{workspaceShares.length === 0 && (
							<Card className='border-dashed border-border/70'>
								<CardHeader>
									<CardTitle className='text-sm'>No handoffs yet</CardTitle>
									<CardDescription>
										Create a workspace handoff to package repo state and deep links for the next person.
									</CardDescription>
								</CardHeader>
							</Card>
						)}
						{workspaceShares.map((share) => (
							<Card key={share.id} className='border-border/70'>
								<CardHeader className='pb-3'>
									<div className='flex items-start justify-between gap-3'>
										<div>
											<CardTitle className='text-sm'>{share.name}</CardTitle>
											<CardDescription className='mt-1'>
												{new Date(share.createdAt).toLocaleString()} · {share.repos.length} repo{share.repos.length === 1 ? '' : 's'}
											</CardDescription>
										</div>
										<Button variant='ghost' size='sm' className='h-10 w-10 p-0' aria-label={`Delete ${share.name}`} onClick={() => { onDelete(share.id); }}>
											<Trash2 className='h-4 w-4' />
										</Button>
									</div>
									{share.note && <p className='text-sm leading-6'>{share.note}</p>}
								</CardHeader>
								<CardContent className='space-y-2'>
									{share.repos.map((repo) => (
										<div key={`${share.id}-${repo.path}`} className='rounded-xl border border-border/60 bg-background/80 p-3'>
											<div className='flex items-start justify-between gap-3'>
												<div className='min-w-0'>
													<p className='truncate text-sm font-medium'>{repo.name}</p>
													<p className='text-muted-foreground truncate text-xs'>
														{repo.head ?? 'detached'} · {repo.path}
													</p>
												</div>
												<div className='flex flex-wrap items-center gap-2'>
													{repo.needsAttention && <Badge variant='outline'>attention</Badge>}
													<Button variant='outline' size='sm' className='h-10 text-xs' onClick={() => { onCopyLink(repo.deepLink); }}>
														<Link2 className='mr-1 h-3.5 w-3.5' />
														Copy Link
													</Button>
												</div>
											</div>
										</div>
									))}
									<CollaborationCommentThread
										title='Handoff discussion'
										comments={commentsByTarget[`workspace-share:${share.id}`] ?? []}
										draft={commentDrafts[`workspace-share:${share.id}`] ?? ''}
										submitPending={commentMutating}
										onDraftChange={(value) => { onCommentDraftChange(`workspace-share:${share.id}`, value); }}
										onSubmit={() => { onCommentSubmit('workspace-share', share.id); }}
										onDelete={onCommentDelete}
									/>
									<CollaborationAssignmentPanel
										title='Handoff assignments'
										assignments={assignmentsByTarget[`workspace-share:${share.id}`] ?? []}
										members={memberOptions}
										selectedAssigneeId={assignmentDrafts[`workspace-share:${share.id}`]?.assigneeId ?? ''}
										noteDraft={assignmentDrafts[`workspace-share:${share.id}`]?.note ?? ''}
										pending={assignmentMutating}
										onAssigneeChange={(value) => { onAssignmentAssigneeChange(`workspace-share:${share.id}`, value); }}
										onNoteChange={(value) => { onAssignmentNoteChange(`workspace-share:${share.id}`, value); }}
										onCreate={() => { onAssignmentCreate('workspace-share', share.id); }}
										onStatusChange={onAssignmentStatusChange}
										onDelete={onAssignmentDelete}
									/>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</ScrollArea>
		</TabsContent>
	);
}

export function PatchShelfTab({
	activeRepo,
	patchName,
	patchBaseRef,
	patchHeadRef,
	repoBranches,
	patchShelf,
	commentDrafts,
	assignmentDrafts,
	commentMutating,
	assignmentMutating,
	commentsByTarget,
	assignmentsByTarget,
	memberOptions,
	createPending,
	onPatchNameChange,
	onPatchBaseRefChange,
	onPatchHeadRefChange,
	onCreate,
	onDelete,
	onCopyPatch,
	onCommentDraftChange,
	onCommentSubmit,
	onCommentDelete,
	onAssignmentAssigneeChange,
	onAssignmentNoteChange,
	onAssignmentCreate,
	onAssignmentStatusChange,
	onAssignmentDelete,
}: {
	activeRepo: string | null;
	patchName: string;
	patchBaseRef: string;
	patchHeadRef: string;
	repoBranches: string[];
	patchShelf: CollaborationPatchShare[];
	commentDrafts: Record<string, string>;
	assignmentDrafts: Record<string, { assigneeId: string; note: string }>;
	commentMutating: boolean;
	assignmentMutating: boolean;
	commentsByTarget: Record<string, CollaborationComment[]>;
	assignmentsByTarget: Record<string, CollaborationAssignment[]>;
	memberOptions: CollaborationMemberProfile[];
	createPending: boolean;
	onPatchNameChange: (value: string) => void;
	onPatchBaseRefChange: (value: string) => void;
	onPatchHeadRefChange: (value: string) => void;
	onCreate: () => void;
	onDelete: (id: string) => void;
	onCopyPatch: (value: string) => void;
	onCommentDraftChange: (targetKey: string, value: string) => void;
	onCommentSubmit: (targetType: 'workspace-share' | 'patch-share', targetId: string) => void;
	onCommentDelete: (id: string) => void;
	onAssignmentAssigneeChange: (targetKey: string, value: string) => void;
	onAssignmentNoteChange: (targetKey: string, value: string) => void;
	onAssignmentCreate: (targetType: 'workspace-share' | 'patch-share', targetId: string) => void;
	onAssignmentStatusChange: (assignmentId: string, status: CollaborationAssignment['status']) => void;
	onAssignmentDelete: (id: string) => void;
}) {
	return (
		<TabsContent value='patches' className='m-0 min-h-0 flex-1 overflow-hidden'>
			<ScrollArea className='h-full'>
				<div className='grid gap-5 p-5 lg:grid-cols-[0.92fr_1.08fr]'>
					<Card className='border-border/70'>
						<CardHeader>
							<CardTitle className='text-sm'>Create Patch Shelf Item</CardTitle>
							<CardDescription>
								Capture a binary patch for a commit range in the active repository.
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-3'>
							<label className='block text-xs font-medium'>
								<span className='mb-1 block text-muted-foreground'>Patch name</span>
								<Input value={patchName} onChange={(event) => { onPatchNameChange(event.target.value); }} />
							</label>
							<label className='block text-xs font-medium'>
								<span className='mb-1 block text-muted-foreground'>Base ref</span>
								<Input list='collaboration-branch-list' value={patchBaseRef} onChange={(event) => { onPatchBaseRefChange(event.target.value); }} />
							</label>
							<label className='block text-xs font-medium'>
								<span className='mb-1 block text-muted-foreground'>Head ref</span>
								<Input list='collaboration-branch-list' value={patchHeadRef} onChange={(event) => { onPatchHeadRefChange(event.target.value); }} />
							</label>
							<datalist id='collaboration-branch-list'>
								{repoBranches.map((branch) => (
									<option key={branch} value={branch} />
								))}
							</datalist>
							<Button className='h-11 w-full' onClick={onCreate} disabled={!activeRepo || createPending || !patchBaseRef.trim() || !patchHeadRef.trim()}>
								Create Patch
							</Button>
						</CardContent>
					</Card>

					<div className='space-y-3'>
						{patchShelf.length === 0 && (
							<Card className='border-dashed border-border/70'>
								<CardHeader>
									<CardTitle className='text-sm'>No patches on the shelf</CardTitle>
									<CardDescription>
										Create a patch artifact for review, handoff, or self-host sync export.
									</CardDescription>
								</CardHeader>
							</Card>
						)}
						{patchShelf.map((patch) => (
							<Card key={patch.id} className='border-border/70'>
								<CardHeader className='pb-3'>
									<div className='flex items-start justify-between gap-3'>
										<div>
											<CardTitle className='text-sm'>{patch.name}</CardTitle>
											<CardDescription className='mt-1'>
												{patch.baseRef}...{patch.headRef} · {patch.summary}
											</CardDescription>
										</div>
										<Button variant='ghost' size='sm' className='h-10 w-10 p-0' aria-label={`Delete ${patch.name}`} onClick={() => { onDelete(patch.id); }}>
											<Trash2 className='h-4 w-4' />
										</Button>
									</div>
								</CardHeader>
								<CardContent>
									<div className='flex flex-wrap gap-2'>
										<Badge variant='outline'>{patch.fileCount} files</Badge>
										<Badge variant='outline'>+{patch.additions}</Badge>
										<Badge variant='outline'>-{patch.deletions}</Badge>
									</div>
									<div className='mt-3 flex flex-wrap gap-2'>
										<Button variant='outline' size='sm' className='h-10 text-xs' onClick={() => { onCopyPatch(patch.patch); }}>
											<Copy className='mr-1 h-3.5 w-3.5' />
											Copy Patch
										</Button>
									</div>
									<CollaborationCommentThread
										title='Patch discussion'
										comments={commentsByTarget[`patch-share:${patch.id}`] ?? []}
										draft={commentDrafts[`patch-share:${patch.id}`] ?? ''}
										submitPending={commentMutating}
										onDraftChange={(value) => { onCommentDraftChange(`patch-share:${patch.id}`, value); }}
										onSubmit={() => { onCommentSubmit('patch-share', patch.id); }}
										onDelete={onCommentDelete}
									/>
									<CollaborationAssignmentPanel
										title='Patch assignments'
										assignments={assignmentsByTarget[`patch-share:${patch.id}`] ?? []}
										members={memberOptions}
										selectedAssigneeId={assignmentDrafts[`patch-share:${patch.id}`]?.assigneeId ?? ''}
										noteDraft={assignmentDrafts[`patch-share:${patch.id}`]?.note ?? ''}
										pending={assignmentMutating}
										onAssigneeChange={(value) => { onAssignmentAssigneeChange(`patch-share:${patch.id}`, value); }}
										onNoteChange={(value) => { onAssignmentNoteChange(`patch-share:${patch.id}`, value); }}
										onCreate={() => { onAssignmentCreate('patch-share', patch.id); }}
										onStatusChange={onAssignmentStatusChange}
										onDelete={onAssignmentDelete}
									/>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</ScrollArea>
		</TabsContent>
	);
}

function ActivityItem({ entry }: { entry: CollaborationActivityEntry }) {
	const Icon =
		entry.status === 'success' ? CheckCircle2 : entry.status === 'failed' ? AlertCircle : Users;

	return (
		<div className='relative pl-6'>
			<div className='bg-border absolute left-[7px] top-0 h-full w-px' />
			<div className={cn('absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background', entry.status === 'success' ? 'border-emerald-500/40 text-emerald-600' : entry.status === 'failed' ? 'border-amber-500/45 text-amber-600' : 'border-border/70 text-muted-foreground')}>
				<Icon className='h-3 w-3' />
			</div>
			<div className='rounded-xl border border-border/60 bg-background/80 p-3'>
				<div className='flex items-start justify-between gap-3'>
					<div>
						<p className='text-sm font-medium leading-5'>{entry.title}</p>
						{entry.description && <p className='text-muted-foreground mt-1 text-xs leading-5'>{entry.description}</p>}
					</div>
					<Badge variant='outline' className='shrink-0'>
						{formatDistanceToNow(entry.timestamp, { addSuffix: true })}
					</Badge>
				</div>
			</div>
		</div>
	);
}

export function CollaborationSyncTab({
	syncConfig,
	importStrategy,
	activity,
	remoteHealth,
	probeError,
	syncPending,
	savePending,
	importPending,
	probePending,
	onSyncConfigChange,
	onImportStrategyChange,
	onSave,
	onProbe,
	onPush,
	onPull,
	onRoundtrip,
	onExport,
	onImport,
}: {
	syncConfig: SyncConfigState;
	importStrategy: 'merge' | 'replace';
	activity: CollaborationActivityEntry[];
	remoteHealth: CollaborationRemoteHealth | null;
	probeError: string | null;
	syncPending: boolean;
	savePending: boolean;
	importPending: boolean;
	probePending: boolean;
	onSyncConfigChange: (patch: Partial<SyncConfigState>) => void;
	onImportStrategyChange: (value: 'merge' | 'replace') => void;
	onSave: () => void;
	onProbe: () => void;
	onPush: () => void;
	onPull: () => void;
	onRoundtrip: () => void;
	onExport: () => void;
	onImport: () => void;
}) {
	return (
		<TabsContent value='sync' className='m-0 min-h-0 flex-1 overflow-hidden'>
			<ScrollArea className='h-full'>
				<div className='grid gap-5 p-5 xl:grid-cols-[1.05fr_0.95fr]'>
					<Card className='border-border/70'>
						<CardHeader>
							<CardTitle className='flex items-center gap-2 text-sm'>
								<Server className='h-4 w-4' />
								Self-Host Sync
							</CardTitle>
							<CardDescription>
								Connect an optional endpoint to exchange collaboration bundles across machines or teammates.
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-4'>
							<div className='grid gap-4 md:grid-cols-2'>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Provider</span>
									<select className='border-border bg-background h-11 w-full rounded-md border px-3 text-sm' value={syncConfig.provider} onChange={() => { onSyncConfigChange({ provider: 'self-host' }); }}>
										<option value='self-host'>Self-host</option>
									</select>
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Project ID</span>
									<Input value={syncConfig.projectId} onChange={(event) => { onSyncConfigChange({ projectId: event.target.value }); }} />
								</label>
							</div>
							<label className='block text-xs font-medium'>
								<span className='mb-1 block text-muted-foreground'>Endpoint URL</span>
								<Input placeholder='https://git-sync.example.com/api/git-graph/collaboration' value={syncConfig.endpointUrl} onChange={(event) => { onSyncConfigChange({ endpointUrl: event.target.value }); }} />
							</label>
							<div className='grid gap-4 md:grid-cols-[1fr_140px]'>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Bearer token</span>
									<Input type='password' placeholder='Optional' value={syncConfig.authToken} onChange={(event) => { onSyncConfigChange({ authToken: event.target.value }); }} />
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Timeout (ms)</span>
									<Input type='number' min={2000} max={120000} value={syncConfig.timeoutMs} onChange={(event) => { onSyncConfigChange({ timeoutMs: Number.parseInt(event.target.value, 10) || syncConfig.timeoutMs }); }} />
								</label>
							</div>
							<div className='grid gap-4 md:grid-cols-2'>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Member ID</span>
									<Input value={syncConfig.memberId} placeholder='ada@example.com' onChange={(event) => { onSyncConfigChange({ memberId: event.target.value }); }} />
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Member API key</span>
									<Input type='password' placeholder='Optional per-member key' value={syncConfig.memberApiKey} onChange={(event) => { onSyncConfigChange({ memberApiKey: event.target.value }); }} />
								</label>
							</div>
							<div className='grid gap-4 md:grid-cols-2'>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Display name</span>
									<Input value={syncConfig.displayName} placeholder='Ada Lovelace' onChange={(event) => { onSyncConfigChange({ displayName: event.target.value }); }} />
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Email</span>
									<Input value={syncConfig.email} placeholder='ada@example.com' onChange={(event) => { onSyncConfigChange({ email: event.target.value }); }} />
								</label>
							</div>
							<div className='grid gap-4 md:grid-cols-4'>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Role</span>
									<select className='border-border bg-background h-11 w-full rounded-md border px-3 text-sm' value={syncConfig.role} onChange={(event) => { onSyncConfigChange({ role: event.target.value as SyncConfigState['role'] }); }}>
										<option value='developer'>Developer</option>
										<option value='reviewer'>Reviewer</option>
										<option value='lead'>Lead</option>
										<option value='qa'>QA</option>
									</select>
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Permission</span>
									<select className='border-border bg-background h-11 w-full rounded-md border px-3 text-sm' value={syncConfig.permissionLevel} onChange={(event) => { onSyncConfigChange({ permissionLevel: event.target.value as SyncConfigState['permissionLevel'] }); }}>
										<option value='owner'>Owner</option>
										<option value='manager'>Manager</option>
										<option value='member'>Member</option>
										<option value='observer'>Observer</option>
									</select>
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Avatar URL</span>
									<Input value={syncConfig.avatarUrl} placeholder='https://example.com/avatar.png' onChange={(event) => { onSyncConfigChange({ avatarUrl: event.target.value }); }} />
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Device label</span>
									<Input value={syncConfig.deviceLabel} placeholder='Design MacBook' onChange={(event) => { onSyncConfigChange({ deviceLabel: event.target.value }); }} />
								</label>
							</div>
							<div className='grid gap-4 md:grid-cols-2'>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Organization ID</span>
									<Input value={syncConfig.organizationId} placeholder='acme' onChange={(event) => { onSyncConfigChange({ organizationId: event.target.value }); }} />
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Organization name</span>
									<Input value={syncConfig.organizationName} placeholder='Acme Engineering' onChange={(event) => { onSyncConfigChange({ organizationName: event.target.value }); }} />
								</label>
							</div>
							<div className='grid gap-4 md:grid-cols-2'>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Team ID</span>
									<Input value={syncConfig.teamId} placeholder='platform' onChange={(event) => { onSyncConfigChange({ teamId: event.target.value }); }} />
								</label>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Team name</span>
									<Input value={syncConfig.teamName} placeholder='Platform Team' onChange={(event) => { onSyncConfigChange({ teamName: event.target.value }); }} />
								</label>
							</div>
							<div className='grid gap-3 md:grid-cols-5'>
								<label className='flex min-h-11 items-center justify-between rounded-xl border border-border/70 px-3 py-2'>
									<div>
										<p className='text-sm font-medium'>Enable remote sync</p>
										<p className='text-muted-foreground text-xs'>Use this endpoint for push, pull, or roundtrip exchange.</p>
									</div>
									<Switch checked={syncConfig.enabled} onCheckedChange={(checked) => { onSyncConfigChange({ enabled: checked }); }} />
								</label>
								<label className='flex min-h-11 items-center justify-between rounded-xl border border-border/70 px-3 py-2'>
									<div>
										<p className='text-sm font-medium'>Auto sync on open</p>
										<p className='text-muted-foreground text-xs'>Run one roundtrip sync when the center opens.</p>
									</div>
									<Switch checked={syncConfig.autoSyncOnOpen} onCheckedChange={(checked) => { onSyncConfigChange({ autoSyncOnOpen: checked }); }} />
								</label>
								<label className='flex min-h-11 items-center justify-between rounded-xl border border-border/70 px-3 py-2'>
									<div>
										<p className='text-sm font-medium'>Publish live presence</p>
										<p className='text-muted-foreground text-xs'>Show who is actively working in the project.</p>
									</div>
									<Switch checked={syncConfig.presenceEnabled} onCheckedChange={(checked) => { onSyncConfigChange({ presenceEnabled: checked }); }} />
								</label>
								<label className='flex min-h-11 items-center justify-between rounded-xl border border-border/70 px-3 py-2'>
									<div>
										<p className='text-sm font-medium'>Live sync</p>
										<p className='text-muted-foreground text-xs'>Roundtrip changes after comments, assignments, and shares.</p>
									</div>
									<Switch checked={syncConfig.liveSyncEnabled} onCheckedChange={(checked) => { onSyncConfigChange({ liveSyncEnabled: checked }); }} />
								</label>
								<label className='flex min-h-11 items-center justify-between rounded-xl border border-border/70 px-3 py-2'>
									<div>
										<p className='text-sm font-medium'>Realtime updates</p>
										<p className='text-muted-foreground text-xs'>Listen for collaboration events and pull fresh shared state.</p>
									</div>
									<Switch checked={syncConfig.realtimeEnabled} onCheckedChange={(checked) => { onSyncConfigChange({ realtimeEnabled: checked }); }} />
								</label>
							</div>
							<div className='flex flex-wrap gap-2 pt-1'>
								<Button onClick={onSave} disabled={savePending} className='h-10'>Save Sync Settings</Button>
								<Button variant='outline' className='h-10' onClick={onProbe} disabled={probePending || !syncConfig.endpointUrl.trim()}>
									<Server className='mr-1 h-4 w-4' />
									Test Endpoint
								</Button>
								<Button variant='outline' className='h-10' onClick={onPush} disabled={!syncConfig.enabled || syncPending}>
									<ArrowUpToLine className='mr-1 h-4 w-4' />
									Push
								</Button>
								<Button variant='outline' className='h-10' onClick={onPull} disabled={!syncConfig.enabled || syncPending}>
									<ArrowDownToLine className='mr-1 h-4 w-4' />
									Pull
								</Button>
								<Button variant='outline' className='h-10' onClick={onRoundtrip} disabled={!syncConfig.enabled || syncPending}>
									<RefreshCw className={`mr-1 h-4 w-4 ${syncPending ? 'animate-spin' : ''}`} />
									Roundtrip
								</Button>
							</div>
						</CardContent>
					</Card>

					<div className='space-y-5'>
						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='text-sm'>Bundle Exchange</CardTitle>
								<CardDescription>
									Export a versioned JSON bundle or import one from another machine.
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-3'>
								<div className='flex flex-wrap gap-2'>
									<Button variant='outline' className='h-10' onClick={onExport}>
										<Upload className='mr-1 h-4 w-4' />
										Export Bundle
									</Button>
									<Button variant='outline' className='h-10' onClick={onImport} disabled={importPending}>
										<ArrowDownToLine className='mr-1 h-4 w-4' />
										Import Bundle
									</Button>
								</div>
								<label className='block text-xs font-medium'>
									<span className='mb-1 block text-muted-foreground'>Import strategy</span>
									<select className='border-border bg-background h-11 w-full rounded-md border px-3 text-sm' value={importStrategy} onChange={(event) => { onImportStrategyChange(event.target.value === 'replace' ? 'replace' : 'merge'); }}>
										<option value='merge'>Merge with existing shares</option>
										<option value='replace'>Replace local collaboration state</option>
									</select>
								</label>
							</CardContent>
						</Card>

						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='text-sm'>Sync Status</CardTitle>
								<CardDescription>
									Visible connection state for the collaboration layer.
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-3'>
								<div className='flex flex-wrap items-center gap-2'>
									<Badge variant='outline'>{syncConfig.enabled ? 'remote enabled' : 'local only'}</Badge>
									<Badge variant='outline'>{syncConfig.lastSyncStatus}</Badge>
									{syncConfig.lastSyncStatus === 'success' && <CheckCircle2 className='h-4 w-4 text-emerald-600' />}
								</div>
								<div className='rounded-xl border border-border/60 bg-background/80 p-3 text-sm'>
									<p className='font-medium'>Last sync</p>
									<p className='text-muted-foreground mt-1 text-xs'>{formatSyncTimestamp(syncConfig.lastSyncedAt)}</p>
								</div>
								<div className='rounded-xl border border-border/60 bg-background/80 p-3 text-sm'>
									<p className='font-medium'>Endpoint probe</p>
									{remoteHealth ? (
										<div className='mt-1 space-y-1 text-xs text-muted-foreground'>
											<p>Version: {remoteHealth.version ?? 'unknown'}</p>
											<p>Projects: {typeof remoteHealth.projectCount === 'number' ? remoteHealth.projectCount : 'unknown'}</p>
											<p>Server time: {remoteHealth.serverTime ?? 'unknown'}</p>
										</div>
									) : probeError ? (
										<p className='mt-1 text-xs text-amber-700/90 dark:text-amber-100/85'>{probeError}</p>
									) : (
										<p className='text-muted-foreground mt-1 text-xs'>Probe the endpoint to verify health and storage details.</p>
									)}
								</div>
								{syncConfig.lastSyncError && (
									<div className='rounded-xl border border-amber-500/35 bg-amber-500/8 p-3 text-sm'>
										<p className='font-medium text-amber-800 dark:text-amber-200'>Last error</p>
										<p className='mt-1 text-xs leading-5 text-amber-700/90 dark:text-amber-100/85'>{syncConfig.lastSyncError}</p>
									</div>
								)}
								<div className='rounded-xl border border-border/60 bg-background/80 p-3 text-xs leading-5 text-muted-foreground'>
									This endpoint contract supports bundle sync plus <code>/presence</code>, <code>/activity</code>, and <code>/events</code> routes for live team context.
								</div>
								{remoteHealth?.storagePath && (
									<div className='rounded-xl border border-border/60 bg-background/80 p-3 text-xs leading-5 text-muted-foreground'>
										Server storage path: <code>{remoteHealth.storagePath}</code>
									</div>
								)}
							</CardContent>
						</Card>

						<Card className='border-border/70'>
							<CardHeader>
								<CardTitle className='text-sm'>Recent Collaboration Activity</CardTitle>
								<CardDescription>
									A durable timeline of handoffs, patch shelf changes, imports, and sync runs.
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-3'>
								{activity.length === 0 ? (
									<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
										No collaboration activity yet.
									</div>
								) : (
									<div className='space-y-3'>
										{activity.map((entry) => (
											<ActivityItem key={entry.id} entry={entry} />
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</ScrollArea>
		</TabsContent>
	);
}

export function CollaborationActivityTab({ activity }: { activity: CollaborationActivityEntry[] }) {
	return (
		<TabsContent value='activity' className='m-0 min-h-0 flex-1 overflow-hidden'>
			<ScrollArea className='h-full'>
				<div className='mx-auto max-w-3xl p-5'>
					<Card className='border-border/70'>
						<CardHeader>
							<CardTitle className='text-sm'>Collaboration Activity Feed</CardTitle>
							<CardDescription>
								Everything that changed in the collaboration layer, in one durable timeline.
							</CardDescription>
						</CardHeader>
						<CardContent className='space-y-4'>
							{activity.length === 0 ? (
								<div className='rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground'>
									No collaboration activity yet.
								</div>
							) : (
								<div className='space-y-4'>
									{activity.map((entry) => (
										<ActivityItem key={entry.id} entry={entry} />
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</ScrollArea>
		</TabsContent>
	);
}
