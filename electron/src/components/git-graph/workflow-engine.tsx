/**
 * Workflow Engine Panel
 * Tower-style workflow templates and execution history.
 */

import { Play, Plus, Trash2, Wand2, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { trpc } from '@/trpc/client';

type WorkflowStepType = 'checkout' | 'fetch' | 'createBranch' | 'merge' | 'rebase' | 'push' | 'openPR' | 'runHook' | 'notify';

interface WorkflowTemplate {
	id: string;
	name: string;
	trigger?: 'manual' | 'onBranchChange' | 'onCommit' | 'onPush';
	onFailure?: 'stop' | 'continue' | 'rollback';
	guards?: Array<{ type: string; value?: string }>;
	inputs?: Array<{ key: string; label: string; required?: boolean; defaultValue?: string }>;
	steps: Array<{ id: string; type: WorkflowStepType; params: Record<string, unknown> }>;
}

interface WorkflowDefinition {
	id: string;
	name: string;
	trigger?: 'manual' | 'onBranchChange' | 'onCommit' | 'onPush';
	onFailure?: 'stop' | 'continue' | 'rollback';
	guards?: Array<{ type: string; value?: string }>;
	inputs?: Array<{ key: string; label: string; required?: boolean; defaultValue?: string }>;
	steps: Array<{ id: string; type: WorkflowStepType; params: Record<string, unknown> }>;
}

interface WorkflowRunStep {
	id: string;
	type: string;
	status: string;
}

interface WorkflowRun {
	id: string;
	workflowId: string;
	status: string;
	startedAt: string | number;
	steps: WorkflowRunStep[];
}

interface WorkflowMutationResult {
	error?: string | null;
	success?: boolean;
	workflow?: { id: string };
}

const WORKFLOW_STEP_TYPES: WorkflowStepType[] = [
	'checkout',
	'fetch',
	'createBranch',
	'merge',
	'rebase',
	'push',
	'openPR',
	'runHook',
	'notify',
];
const WORKFLOW_GUARD_TYPES = ['cleanWorkingTree', 'branchMatches', 'hasUpstream'] as const;
type WorkflowGuardType = (typeof WORKFLOW_GUARD_TYPES)[number];

interface WorkflowInputForm {
	key: string;
	label: string;
	required: boolean;
	defaultValue?: string;
}

interface WorkflowGuardForm {
	type: WorkflowGuardType;
	value?: string;
}

type WorkflowParamValueType = 'string' | 'boolean' | 'number';

interface WorkflowStepParamForm {
	id: string;
	key: string;
	valueType: WorkflowParamValueType;
	value: string;
}

interface WorkflowStepForm {
	id: string;
	type: WorkflowStepType;
	params: WorkflowStepParamForm[];
}

const createFormId = (): string => Math.random().toString(36).slice(2, 10);

const normalizeGuardType = (type: string): WorkflowGuardType =>
	WORKFLOW_GUARD_TYPES.includes(type as WorkflowGuardType) ? (type as WorkflowGuardType) : 'cleanWorkingTree';

const toStepParamForm = (key: string, value: unknown): WorkflowStepParamForm => {
	if (typeof value === 'boolean') {
		return { id: createFormId(), key, valueType: 'boolean', value: value ? 'true' : 'false' };
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return { id: createFormId(), key, valueType: 'number', value: String(value) };
	}
	if (typeof value === 'string') {
		return { id: createFormId(), key, valueType: 'string', value };
	}
	return {
		id: createFormId(),
		key,
		valueType: 'string',
		value: value === undefined ? '' : JSON.stringify(value),
	};
};

const parseStepParamValue = (param: WorkflowStepParamForm): unknown => {
	if (param.valueType === 'boolean') {
		return param.value.trim().toLowerCase() === 'true';
	}
	if (param.valueType === 'number') {
		const parsed = Number(param.value);
		return Number.isFinite(parsed) ? parsed : param.value;
	}
	return param.value;
};

const TEMPLATES: WorkflowTemplate[] = [
	{
		id: 'feature-start-finish',
		name: 'Feature branch start/finish',
		inputs: [
			{ key: 'branchName', label: 'Branch name', required: true },
			{ key: 'base', label: 'Base branch', defaultValue: 'main' },
		],
		guards: [{ type: 'cleanWorkingTree' }],
		steps: [
			{ id: 'fetch', type: 'fetch', params: { remote: 'origin' } },
			{ id: 'create', type: 'createBranch', params: { name: '${inputs.branchName}', from: '${inputs.base}' } },
			{ id: 'push', type: 'push', params: { remote: 'origin', branch: 'HEAD' } },
		],
	},
	{
		id: 'release-cut',
		name: 'Release cut + tagging',
		inputs: [
			{ key: 'base', label: 'Base branch', defaultValue: 'main' },
			{ key: 'releaseTag', label: 'Release tag (e.g. v1.2.3)', required: true },
		],
		guards: [{ type: 'cleanWorkingTree' }],
		steps: [
			{ id: 'checkout-main', type: 'checkout', params: { ref: '${inputs.base}' } },
			{ id: 'fetch', type: 'fetch', params: { remote: 'origin' } },
			{ id: 'pull', type: 'runHook', params: { command: 'git pull --ff-only origin ${inputs.base}' } },
			{ id: 'tag', type: 'runHook', params: { command: 'git tag ${inputs.releaseTag}' } },
			{ id: 'push-branch', type: 'push', params: { remote: 'origin', branch: '${inputs.base}' } },
			{ id: 'push-tag', type: 'runHook', params: { command: 'git push origin ${inputs.releaseTag}' } },
		],
	},
	{
		id: 'hotfix',
		name: 'Hotfix flow',
		inputs: [
			{ key: 'branchName', label: 'Hotfix branch name', required: true },
			{ key: 'base', label: 'Base branch', defaultValue: 'main' },
		],
		guards: [{ type: 'cleanWorkingTree' }],
		steps: [
			{ id: 'checkout-main', type: 'checkout', params: { ref: '${inputs.base}' } },
			{ id: 'create-hotfix', type: 'createBranch', params: { name: '${inputs.branchName}', from: '${inputs.base}' } },
			{ id: 'push', type: 'push', params: { remote: 'origin', branch: 'HEAD' } },
		],
	},
	{
		id: 'stack-update',
		name: 'Stack PR update + restack + push',
		onFailure: 'rollback',
		inputs: [{ key: 'base', label: 'Stack base branch', defaultValue: 'main' }],
		steps: [
			{ id: 'fetch', type: 'fetch', params: { remote: 'origin' } },
			{ id: 'rebase', type: 'rebase', params: { onto: '${inputs.base}' } },
			{ id: 'restack', type: 'runHook', params: { command: 'gt restack' } },
			{ id: 'push', type: 'push', params: { remote: 'origin', branch: 'HEAD', force: true } },
		],
	},
];

export function WorkflowEngineDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { activeRepo } = useAppStore();
	const { notifySuccess, notifyError } = useAppNotifications();
	const trpcUtils = trpc.useUtils();
	const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
	const [newWorkflowName, setNewWorkflowName] = useState('');
	const [editorName, setEditorName] = useState('');
	const [editorTrigger, setEditorTrigger] = useState<'manual' | 'onBranchChange' | 'onCommit' | 'onPush'>('manual');
	const [editorOnFailure, setEditorOnFailure] = useState<'stop' | 'continue' | 'rollback'>('stop');
	const [editorGuards, setEditorGuards] = useState<WorkflowGuardForm[]>([]);
	const [editorInputs, setEditorInputs] = useState<WorkflowInputForm[]>([]);
	const [editorSteps, setEditorSteps] = useState<WorkflowStepForm[]>([]);
	const [dryRunGraph, setDryRunGraph] = useState<{
		nodes: Array<{ id: string; label: string }>;
		edges: Array<{ from: string; to: string }>;
	} | null>(null);
	const [dryRunWarnings, setDryRunWarnings] = useState<string[]>([]);

	const listQuery = trpc.git.workflow.list.useQuery(undefined, { enabled: open });
	const createMutation = trpc.git.workflow.create.useMutation({
		onSuccess: async (result: WorkflowMutationResult) => {
			if (result.error) {
				notifyError('Workflow create failed', { description: result.error });
				return;
			}
			notifySuccess('Workflow created');
			if (result.workflow?.id) {
				setSelectedWorkflowId(result.workflow.id);
			}
			await trpcUtils.git.workflow.list.invalidate();
		},
	});
	const deleteMutation = trpc.git.workflow.delete.useMutation({
		onSuccess: async (result: WorkflowMutationResult) => {
			if (!result.success) {
				notifyError('Workflow delete failed', { description: result.error ?? 'Failed to delete workflow' });
				return;
			}
			notifySuccess('Workflow deleted');
			await trpcUtils.git.workflow.list.invalidate();
		},
	});
	const updateMutation = trpc.git.workflow.update.useMutation({
		onSuccess: async (result: WorkflowMutationResult) => {
			if (result.error) {
				notifyError('Workflow update failed', { description: result.error });
				return;
			}
			notifySuccess('Workflow updated');
			await trpcUtils.git.workflow.list.invalidate();
		},
	});
	const dryRunMutation = trpc.git.workflow.dryRun.useMutation();
	const executeMutation = trpc.git.workflow.execute.useMutation({
		onSuccess: async (result: WorkflowMutationResult) => {
			if (result.error) {
				notifyError('Workflow run failed', { description: result.error });
				return;
			}
			notifySuccess('Workflow run completed');
			await trpcUtils.git.workflow.list.invalidate();
		},
	});

	const definitions: WorkflowDefinition[] = listQuery.data?.definitions ?? [];
	const runs: WorkflowRun[] = listQuery.data?.runs ?? [];
	const selectedWorkflow = useMemo(
		() => definitions.find((workflow) => workflow.id === selectedWorkflowId) ?? definitions[0] ?? null,
		[definitions, selectedWorkflowId]
	);
	const selectedRuns = useMemo(
		() =>
			runs
				.filter((run) => run.workflowId === selectedWorkflow?.id)
				.slice()
				.reverse()
				.slice(0, 20),
		[runs, selectedWorkflow?.id]
	);

	useEffect(() => {
		if (!selectedWorkflow) {
			setEditorName('');
			setEditorTrigger('manual');
			setEditorOnFailure('stop');
			setEditorGuards([]);
			setEditorInputs([]);
			setEditorSteps([]);
			return;
		}
			setEditorName(selectedWorkflow.name);
			setEditorTrigger(selectedWorkflow.trigger ?? 'manual');
			setEditorOnFailure(selectedWorkflow.onFailure ?? 'stop');
			setEditorGuards(
				(selectedWorkflow.guards ?? []).map((guard) => ({
					type: normalizeGuardType(guard.type),
				...(guard.value ? { value: guard.value } : {}),
			}))
		);
		setEditorInputs(
			(selectedWorkflow.inputs ?? []).map((input) => ({
				key: input.key,
				label: input.label,
				required: Boolean(input.required),
				...(input.defaultValue ? { defaultValue: input.defaultValue } : {}),
			}))
		);
		setEditorSteps(
			(selectedWorkflow.steps ?? []).map((step) => ({
				id: step.id,
				type: step.type as WorkflowStepType,
				params: Object.entries(step.params ?? {}).map(([key, value]) => toStepParamForm(key, value)),
			}))
		);
	}, [selectedWorkflow]);

	const updateInput = (index: number, patch: Partial<WorkflowInputForm>) => {
		setEditorInputs((previous) =>
			previous.map((input, currentIndex) => (currentIndex === index ? { ...input, ...patch } : input))
		);
	};

	const updateGuard = (index: number, patch: Partial<WorkflowGuardForm>) => {
		setEditorGuards((previous) =>
			previous.map((guard, currentIndex) => (currentIndex === index ? { ...guard, ...patch } : guard))
		);
	};

	const updateStep = (index: number, patch: Partial<WorkflowStepForm>) => {
		setEditorSteps((previous) =>
			previous.map((step, currentIndex) => (currentIndex === index ? { ...step, ...patch } : step))
		);
	};

	const addStepParam = (stepIndex: number) => {
		setEditorSteps((previous) =>
			previous.map((step, currentIndex) =>
				currentIndex === stepIndex
					? {
							...step,
							params: [...step.params, { id: createFormId(), key: '', valueType: 'string', value: '' }],
						}
					: step
			)
		);
	};

	const updateStepParam = (stepIndex: number, paramId: string, patch: Partial<WorkflowStepParamForm>) => {
		setEditorSteps((previous) =>
			previous.map((step, currentStepIndex) =>
				currentStepIndex === stepIndex
					? {
							...step,
							params: step.params.map((param) => (param.id === paramId ? { ...param, ...patch } : param)),
						}
					: step
			)
		);
	};

	const removeStepParam = (stepIndex: number, paramId: string) => {
		setEditorSteps((previous) =>
			previous.map((step, currentStepIndex) =>
				currentStepIndex === stepIndex
					? {
							...step,
							params: step.params.filter((param) => param.id !== paramId),
						}
					: step
			)
		);
	};

	const moveStep = (index: number, direction: -1 | 1) => {
		setEditorSteps((previous) => {
			const targetIndex = index + direction;
			if (targetIndex < 0 || targetIndex >= previous.length) {
				return previous;
			}
			const next = [...previous];
			const [step] = next.splice(index, 1);
			if (!step) {
				return previous;
			}
			next.splice(targetIndex, 0, step);
			return next;
		});
	};

	const handleCreateTemplate = (templateId: string) => {
		const template = TEMPLATES.find((entry) => entry.id === templateId);
		if (!template) {
			return;
		}
		createMutation.mutate({
			name: template.name,
			trigger: template.trigger ?? 'manual',
			steps: template.steps,
			inputs: template.inputs ?? [],
			guards: template.guards ?? [],
			onFailure: template.onFailure ?? 'stop',
		});
	};

	const handleCreateBlank = () => {
		const name = newWorkflowName.trim();
		if (!name) {
			toast.error('Workflow name is required');
			return;
		}
		createMutation.mutate({
			name,
			trigger: 'manual',
			steps: [{ id: 'fetch', type: 'fetch', params: { remote: 'origin' } }],
			inputs: [],
			guards: [],
			onFailure: 'stop',
		});
		setNewWorkflowName('');
	};

	const handleDryRun = async () => {
		if (!activeRepo || !selectedWorkflow) {
			return;
		}
		const result = await dryRunMutation.mutateAsync({
			repo: activeRepo,
			workflowId: selectedWorkflow.id,
			inputs: {},
		});
		if (result.error) {
			toast.error(result.error);
			return;
		}
		setDryRunGraph(result.graph);
		setDryRunWarnings(result.warnings);
		if (result.warnings.length > 0) {
			toast.warning(result.warnings.join('\n'));
		} else {
			toast.success('Dry run completed with no warnings');
		}
	};

	const handleSaveWorkflow = () => {
		if (!selectedWorkflow) {
			return;
		}
		if (!editorName.trim()) {
			toast.error('Workflow name is required');
			return;
		}
		if (!Array.isArray(editorSteps) || editorSteps.length === 0) {
			toast.error('Workflow must include at least one step');
			return;
		}
		let parsedSteps: Array<{ id: string; type: WorkflowStepType; params: Record<string, unknown> }> = [];
		try {
			parsedSteps = editorSteps.map((step, index) => {
				const stepId = step.id.trim();
				if (!stepId) {
					throw new Error(`Step ${String(index + 1)} is missing an id`);
				}
				const params = step.params.reduce<Record<string, unknown>>((acc, param) => {
					const key = param.key.trim();
					if (!key) {
						return acc;
					}
					acc[key] = parseStepParamValue(param);
					return acc;
				}, {});
				return {
					id: stepId,
					type: step.type,
					params,
				};
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Invalid workflow step data');
			return;
		}
		const uniqueStepIds = new Set(parsedSteps.map((step) => step.id));
		if (uniqueStepIds.size !== parsedSteps.length) {
			toast.error('Step IDs must be unique');
			return;
		}
		const parsedInputs = editorInputs
			.map((input) => ({
				key: input.key.trim(),
				label: input.label.trim(),
				required: Boolean(input.required),
				...(input.defaultValue?.trim() ? { defaultValue: input.defaultValue.trim() } : {}),
			}))
			.filter((input) => input.key.length > 0 && input.label.length > 0);
		const parsedGuards = editorGuards
			.map((guard) => ({
				type: guard.type,
				...(guard.value?.trim() ? { value: guard.value.trim() } : {}),
			}))
			.filter((guard) => guard.type.length > 0);

		updateMutation.mutate({
			id: selectedWorkflow.id,
			name: editorName.trim(),
			trigger: editorTrigger,
			onFailure: editorOnFailure,
			steps: parsedSteps,
			guards: parsedGuards as Array<{ type: string; value?: string }>,
			inputs: parsedInputs,
		});
	};

	const handleExecute = () => {
		if (!activeRepo || !selectedWorkflow) {
			return;
		}
		executeMutation.mutate({
			repo: activeRepo,
			workflowId: selectedWorkflow.id,
			inputs: {},
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='ui-surface max-h-[85vh] max-w-5xl'>
				<DialogHeader>
					<DialogTitle>Workflow Engine</DialogTitle>
				</DialogHeader>
				<div className='grid grid-cols-[260px_1fr] gap-4'>
					<div className='rounded-lg border'>
						<div className='border-b p-2'>
							<p className='text-sm font-medium'>Templates</p>
							<div className='mt-2 grid gap-1'>
								{TEMPLATES.map((template) => (
									<Button
										key={template.id}
										variant='ghost'
										size='sm'
										className='justify-start'
										onClick={() => {
											handleCreateTemplate(template.id);
										}}>
										<Wand2 className='mr-2 h-3.5 w-3.5' />
										{template.name}
									</Button>
								))}
							</div>
							<div className='mt-3 flex gap-2'>
								<Input
									value={newWorkflowName}
									onChange={(event) => { setNewWorkflowName(event.target.value); }}
									placeholder='Custom workflow name'
								/>
								<Button size='sm' onClick={handleCreateBlank}>
									<Plus className='h-4 w-4' />
								</Button>
							</div>
						</div>
						<ScrollArea className='h-[48vh]'>
							<div className='space-y-1 p-2'>
								{definitions.map((workflow) => (
									<button
										key={workflow.id}
										type='button'
										className={`w-full rounded-md border px-2 py-1.5 text-left text-sm ${selectedWorkflow?.id === workflow.id ? 'border-primary bg-primary/10' : 'hover:bg-accent'}`}
										onClick={() => { setSelectedWorkflowId(workflow.id); }}>
										<p className='truncate font-medium'>{workflow.name}</p>
										<p className='text-muted-foreground text-xs'>{workflow.steps.length} steps</p>
									</button>
								))}
								{definitions.length === 0 && (
									<p className='text-muted-foreground p-2 text-xs'>No workflows yet</p>
								)}
							</div>
						</ScrollArea>
					</div>

					<div className='space-y-3 rounded-lg border p-3'>
						{selectedWorkflow ? (
							<>
								<div className='flex items-center justify-between'>
									<div>
										<p className='text-base font-medium'>{selectedWorkflow.name}</p>
										<p className='text-muted-foreground text-xs'>{selectedWorkflow.trigger}</p>
									</div>
									<div className='flex gap-2'>
										<Button variant='outline' size='sm' onClick={() => { void handleDryRun(); }}>
											<Play className='mr-1 h-3.5 w-3.5' />
											Dry run
										</Button>
										<Button size='sm' onClick={handleExecute} disabled={!activeRepo || executeMutation.isPending}>
											{executeMutation.isPending ? <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' /> : <Play className='mr-1 h-3.5 w-3.5' />}
											Run
										</Button>
										<Button
											variant='outline'
											size='sm'
											onClick={() => {
												deleteMutation.mutate({ id: selectedWorkflow.id });
											}}>
											<Trash2 className='h-3.5 w-3.5' />
										</Button>
									</div>
								</div>

								<div className='space-y-2'>
									<p className='text-xs font-semibold tracking-wide text-muted-foreground'>Steps</p>
									{selectedWorkflow.steps.map((step, index) => (
										<div key={step.id} className='rounded-md border p-2'>
											<div className='mb-1 flex items-center gap-2'>
												<Badge variant='outline'>{index + 1}</Badge>
												<span className='font-medium'>{step.type}</span>
											</div>
											<pre className='text-muted-foreground overflow-x-auto text-xs'>
												{JSON.stringify(step.params, null, 2)}
											</pre>
										</div>
									))}
								</div>

								<div className='space-y-2 rounded-md border p-2'>
									<p className='text-xs font-semibold tracking-wide text-muted-foreground'>Workflow Builder</p>
									<div className='grid grid-cols-2 gap-2'>
										<div className='space-y-1'>
											<p className='text-xs text-muted-foreground'>Name</p>
											<Input value={editorName} onChange={(event) => { setEditorName(event.target.value); }} />
										</div>
										<div className='space-y-1'>
											<p className='text-xs text-muted-foreground'>Trigger</p>
											<select
												className='h-9 w-full rounded-md border bg-background px-2 text-sm'
												value={editorTrigger}
												onChange={(event) => { setEditorTrigger(event.target.value as 'manual' | 'onBranchChange' | 'onCommit' | 'onPush'); }}>
												<option value='manual'>manual</option>
												<option value='onBranchChange'>onBranchChange</option>
												<option value='onCommit'>onCommit</option>
												<option value='onPush'>onPush</option>
											</select>
										</div>
									</div>
									<div className='grid grid-cols-2 gap-2'>
										<div className='space-y-1'>
											<p className='text-xs text-muted-foreground'>On Failure</p>
											<select
												className='h-9 w-full rounded-md border bg-background px-2 text-sm'
												value={editorOnFailure}
												onChange={(event) => { setEditorOnFailure(event.target.value as 'stop' | 'continue' | 'rollback'); }}>
												<option value='stop'>stop</option>
												<option value='continue'>continue</option>
												<option value='rollback'>rollback</option>
											</select>
										</div>
										<div className='space-y-1'>
											<p className='text-xs text-muted-foreground'>Interpolation</p>
											<p className='text-xs text-muted-foreground'>Use `${'{inputs.key}'}` and `${'{repo}'}` in step params.</p>
										</div>
									</div>
									<div className='space-y-2 rounded-md border p-2'>
										<div className='flex items-center justify-between'>
											<p className='text-xs font-semibold tracking-wide text-muted-foreground'>Inputs</p>
											<Button
												type='button'
												variant='outline'
												size='sm'
												onClick={() => {
													setEditorInputs((previous) => [...previous, { key: '', label: '', required: false, defaultValue: '' }]);
												}}>
												<Plus className='mr-1 h-3.5 w-3.5' />
												Add input
											</Button>
										</div>
										<div className='space-y-2'>
											{editorInputs.map((input, index) => (
												<div key={`${input.key}-${String(index)}`} className='grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-2'>
													<Input
														placeholder='key'
														value={input.key}
														onChange={(event) => {
															updateInput(index, { key: event.target.value });
														}}
													/>
													<Input
														placeholder='label'
														value={input.label}
														onChange={(event) => {
															updateInput(index, { label: event.target.value });
														}}
													/>
													<Input
														placeholder='default value'
														value={input.defaultValue ?? ''}
														onChange={(event) => {
															updateInput(index, { defaultValue: event.target.value });
														}}
													/>
													<label className='flex items-center gap-2 text-xs text-muted-foreground'>
														<Checkbox
															checked={input.required}
															onCheckedChange={(checked) => {
																updateInput(index, { required: Boolean(checked) });
															}}
														/>
														Required
													</label>
													<Button
														type='button'
														variant='ghost'
														size='sm'
														onClick={() => {
															setEditorInputs((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
														}}>
														<Trash2 className='h-3.5 w-3.5' />
													</Button>
												</div>
											))}
											{editorInputs.length === 0 && (
												<p className='text-xs text-muted-foreground'>No workflow inputs configured.</p>
											)}
										</div>
									</div>
									<div className='space-y-2 rounded-md border p-2'>
										<div className='flex items-center justify-between'>
											<p className='text-xs font-semibold tracking-wide text-muted-foreground'>Guards</p>
											<Button
												type='button'
												variant='outline'
												size='sm'
												onClick={() => {
													setEditorGuards((previous) => [...previous, { type: 'cleanWorkingTree', value: '' }]);
												}}>
												<Plus className='mr-1 h-3.5 w-3.5' />
												Add guard
											</Button>
										</div>
										<div className='space-y-2'>
											{editorGuards.map((guard, index) => (
												<div key={`${guard.type}-${String(index)}`} className='grid grid-cols-[180px_1fr_auto] items-center gap-2'>
													<select
														className='h-9 w-full rounded-md border bg-background px-2 text-sm'
														value={guard.type}
														onChange={(event) => {
															updateGuard(index, { type: normalizeGuardType(event.target.value) });
														}}>
														{WORKFLOW_GUARD_TYPES.map((guardType) => (
															<option key={guardType} value={guardType}>
																{guardType}
															</option>
														))}
													</select>
													<Input
														placeholder={guard.type === 'branchMatches' ? 'Regex pattern (e.g. ^feature/)' : 'Optional value'}
														value={guard.value ?? ''}
														onChange={(event) => {
															updateGuard(index, { value: event.target.value });
														}}
														disabled={guard.type !== 'branchMatches'}
													/>
													<Button
														type='button'
														variant='ghost'
														size='sm'
														onClick={() => {
															setEditorGuards((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
														}}>
														<Trash2 className='h-3.5 w-3.5' />
													</Button>
												</div>
											))}
											{editorGuards.length === 0 && (
												<p className='text-xs text-muted-foreground'>No workflow guards configured.</p>
											)}
										</div>
									</div>
									<div className='space-y-2 rounded-md border p-2'>
										<div className='flex items-center justify-between'>
											<p className='text-xs font-semibold tracking-wide text-muted-foreground'>Steps</p>
											<Button
												type='button'
												variant='outline'
												size='sm'
												onClick={() => {
													setEditorSteps((previous) => [
														...previous,
														{
															id: `step-${String(previous.length + 1)}`,
															type: 'fetch',
															params: [{ id: createFormId(), key: 'remote', valueType: 'string', value: 'origin' }],
														},
													]);
												}}>
												<Plus className='mr-1 h-3.5 w-3.5' />
												Add step
											</Button>
										</div>
										<div className='space-y-2'>
											{editorSteps.map((step, index) => (
												<div key={`${step.id}-${String(index)}`} className='space-y-2 rounded-md border p-2'>
													<div className='grid grid-cols-[1fr_180px_auto_auto_auto] items-center gap-2'>
														<Input
															placeholder='step id'
															value={step.id}
															onChange={(event) => {
																updateStep(index, { id: event.target.value });
															}}
														/>
														<select
															className='h-9 w-full rounded-md border bg-background px-2 text-sm'
															value={step.type}
															onChange={(event) => {
																updateStep(index, { type: event.target.value as WorkflowStepType });
															}}>
															{WORKFLOW_STEP_TYPES.map((stepType) => (
																<option key={stepType} value={stepType}>
																	{stepType}
																</option>
															))}
														</select>
														<Button
															type='button'
															variant='ghost'
															size='sm'
															disabled={index === 0}
															onClick={() => {
																moveStep(index, -1);
															}}>
															Up
														</Button>
														<Button
															type='button'
															variant='ghost'
															size='sm'
															disabled={index === editorSteps.length - 1}
															onClick={() => {
																moveStep(index, 1);
															}}>
															Down
														</Button>
														<Button
															type='button'
															variant='ghost'
															size='sm'
															onClick={() => {
																setEditorSteps((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
															}}>
															<Trash2 className='h-3.5 w-3.5' />
														</Button>
													</div>
													<div className='space-y-2 rounded-md border p-2'>
														<div className='flex items-center justify-between'>
															<p className='text-xs text-muted-foreground'>Step params</p>
															<Button
																type='button'
																variant='outline'
																size='sm'
																onClick={() => {
																	addStepParam(index);
																}}>
																<Plus className='mr-1 h-3.5 w-3.5' />
																Add param
															</Button>
														</div>
														<div className='space-y-2'>
															{step.params.map((param) => (
																<div key={param.id} className='grid grid-cols-[1fr_140px_1fr_auto] items-center gap-2'>
																	<Input
																		placeholder='key'
																		value={param.key}
																		onChange={(event) => {
																			updateStepParam(index, param.id, { key: event.target.value });
																		}}
																	/>
																	<select
																		className='h-9 w-full rounded-md border bg-background px-2 text-sm'
																		value={param.valueType}
																		onChange={(event) => {
																			updateStepParam(index, param.id, {
																				valueType: event.target.value as WorkflowParamValueType,
																			});
																		}}>
																		<option value='string'>string</option>
																		<option value='boolean'>boolean</option>
																		<option value='number'>number</option>
																	</select>
																	{param.valueType === 'boolean' ? (
																		<select
																			className='h-9 w-full rounded-md border bg-background px-2 text-sm'
																			value={param.value.toLowerCase() === 'true' ? 'true' : 'false'}
																			onChange={(event) => {
																				updateStepParam(index, param.id, { value: event.target.value });
																			}}>
																			<option value='true'>true</option>
																			<option value='false'>false</option>
																		</select>
																	) : (
																		<Input
																			placeholder='value'
																			value={param.value}
																			onChange={(event) => {
																				updateStepParam(index, param.id, { value: event.target.value });
																			}}
																		/>
																	)}
																	<Button
																		type='button'
																		variant='ghost'
																		size='sm'
																		onClick={() => {
																			removeStepParam(index, param.id);
																		}}>
																		<Trash2 className='h-3.5 w-3.5' />
																	</Button>
																</div>
															))}
															{step.params.length === 0 && (
																<p className='text-xs text-muted-foreground'>No params for this step.</p>
															)}
														</div>
													</div>
												</div>
											))}
											{editorSteps.length === 0 && (
												<p className='text-xs text-muted-foreground'>No steps configured. Add at least one step.</p>
											)}
										</div>
									</div>
									<div className='flex justify-end'>
										<Button size='sm' onClick={handleSaveWorkflow} disabled={updateMutation.isPending}>
											{updateMutation.isPending ? <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' /> : null}
											Save Workflow
										</Button>
									</div>
								</div>

								<div className='space-y-2'>
									<p className='text-xs font-semibold tracking-wide text-muted-foreground'>Dry-run Graph</p>
									<div className='rounded-md border p-2 text-xs'>
										{dryRunGraph ? (
											<>
												<p className='font-medium'>Nodes</p>
												<div className='mb-2 space-y-1'>
													{dryRunGraph.nodes.map((node) => (
														<p key={node.id}>
															{node.id}: {node.label}
														</p>
													))}
												</div>
												<p className='font-medium'>Edges</p>
												<div className='space-y-1'>
													{dryRunGraph.edges.map((edge, index) => (
														<p key={`${edge.from}-${edge.to}-${String(index)}`}>
															{edge.from} → {edge.to}
														</p>
													))}
												</div>
												{dryRunWarnings.length > 0 && (
													<div className='mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2'>
														<p className='mb-1 font-medium'>Warnings</p>
														{dryRunWarnings.map((warning) => (
															<p key={warning}>{warning}</p>
														))}
													</div>
												)}
											</>
										) : (
											<p className='text-muted-foreground'>Run dry-run to inspect execution graph and risks.</p>
										)}
									</div>
								</div>

								<div className='space-y-2'>
									<p className='text-xs font-semibold tracking-wide text-muted-foreground'>Recent runs</p>
									<ScrollArea className='h-40 rounded-md border p-2'>
										<div className='space-y-2'>
											{selectedRuns.map((run) => (
													<div key={run.id} className='rounded border px-2 py-1 text-xs'>
														<p className='font-medium'>{run.status}</p>
														<p className='text-muted-foreground'>{new Date(run.startedAt).toLocaleString()}</p>
														{run.steps.length > 0 && (
															<div className='mt-1 flex flex-wrap gap-1'>
																{run.steps.map((step) => (
																	<Badge key={`${run.id}-${step.id}`} variant='outline'>
																		{step.type}:{step.status}
																	</Badge>
																))}
															</div>
														)}
													</div>
												))}
											{selectedRuns.length === 0 && (
												<p className='text-muted-foreground text-xs'>No runs yet</p>
											)}
										</div>
									</ScrollArea>
								</div>
							</>
						) : (
							<div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
								No workflow selected
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default WorkflowEngineDialog;
