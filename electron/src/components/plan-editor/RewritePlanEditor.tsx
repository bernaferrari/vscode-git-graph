/**
 * Rewrite Plan Editor
 * Visual editor for safe history rewriting
 */

import {
	GitBranch,
	GitCommit,
	ArrowUp,
	ArrowDown,
	Trash2,
	Plus,
	Edit,
	Copy,
	Merge,
	RotateCcw,
	Play,
	Save,
	Eye,
	CheckCircle2,
	XCircle,
} from 'lucide-react';
import { useState, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type RewriteOpType = 
	| 'drop'
	| 'reorder'
	| 'squash'
	| 'fixup'
	| 'reword'
	| 'cherry-pick'
	| 'move'
	| 'rebase_onto';

export interface RewriteOp {
	id: string;
	type: RewriteOpType;
	commitHash: string;
	message: string;
	target?: string; // For cherry-pick, move
	afterCommit?: string; // For reorder
	// UI state
	isExpanded: boolean;
	isValid: boolean;
	validationMessage?: string;
}

export interface RewritePlan {
	id: string;
	name: string;
	sourceBranch: string;
	baseBranch: string;
	ops: RewriteOp[];
	createdAt: number;
	updatedAt: number;
	status: 'draft' | 'validated' | 'applied';
}

interface RewritePlanEditorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sourceBranch: string;
	baseBranch: string;
	commits: Array<{ hash: string; message: string }>;
	onApplyPlan: (plan: RewritePlan) => void;
	onSaveDraft: (plan: RewritePlan) => void;
}

// Operation type definitions
const OP_CONFIG: Record<RewriteOpType, {
	label: string;
	icon: React.ElementType;
	color: string;
	description: string;
}> = {
	drop: {
		label: 'Remove',
		icon: Trash2,
		color: 'text-destructive',
		description: 'Delete this commit entirely',
	},
	reorder: {
		label: 'Rearrange',
		icon: ArrowUp,
		color: 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',
		description: 'Move commit to a different position',
	},
	squash: {
		label: 'Combine',
		icon: Merge,
		color: 'text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]',
		description: 'Merge this commit into previous',
	},
	fixup: {
		label: 'Fix up',
		icon: Edit,
		color: 'text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
		description: 'Merge into previous, discard message',
	},
	reword: {
		label: 'Change message',
		icon: Edit,
		color: 'text-[color-mix(in_oklch,var(--chart-7)_75%,var(--foreground))]',
		description: 'Edit commit message',
	},
	'cherry-pick': {
		label: 'Copy to…',
		icon: Copy,
		color: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
		description: 'Copy this commit to another branch',
	},
	move: {
		label: 'Relocate',
		icon: ArrowUp,
		color: 'text-[color-mix(in_oklch,var(--chart-8)_75%,var(--foreground))]',
		description: 'Move to another branch (copy + remove)',
	},
	rebase_onto: {
		label: 'Rebase onto',
		icon: RotateCcw,
		color: 'text-[color-mix(in_oklch,var(--primary)_72%,var(--foreground))]',
		description: 'Replay all commits onto new base',
	},
};

export function RewritePlanEditor({
	open,
	onOpenChange,
	sourceBranch,
	baseBranch,
	onApplyPlan,
	onSaveDraft,
}: RewritePlanEditorProps) {
	const [planName, setPlanName] = useState('My rewrite plan');
	const [operations, setOperations] = useState<RewriteOp[]>([]);
	const [isValidating, setIsValidating] = useState(false);
	const [validationResults, setValidationResults] = useState<{ valid: boolean; message: string } | null>(null);

	// Add a new operation
	const addOperation = useCallback((type: RewriteOpType, commit?: { hash: string; message: string }) => {
		const newOp: RewriteOp = {
			id: `op-${String(Date.now())}-${Math.random().toString(36).substring(2, 11)}`,
			type,
			commitHash: commit?.hash || '',
			message: commit?.message || '',
			isExpanded: true,
			isValid: true,
		};
		setOperations((prev) => [...prev, newOp]);
	}, []);

	// Remove operation
	const removeOperation = useCallback((id: string) => {
		setOperations((prev) => prev.filter((op) => op.id !== id));
	}, []);

	// Update operation
	const updateOperation = useCallback((id: string, updates: Partial<RewriteOp>) => {
		setOperations((prev) =>
			prev.map((op) => (op.id === id ? { ...op, ...updates } : op))
		);
	}, []);

	// Move operation up/down
	const moveOperation = useCallback((id: string, direction: 'up' | 'down') => {
		setOperations((prev) => {
			const index = prev.findIndex((op) => op.id === id);
			if (index === -1) return prev;
			
			const newIndex = direction === 'up' ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= prev.length) return prev;
			
			const newOps = [...prev];
			const currentOp = newOps[index];
			const targetOp = newOps[newIndex];
			if (!currentOp || !targetOp) return prev;
			newOps[index] = targetOp;
			newOps[newIndex] = currentOp;
			return newOps;
		});
	}, []);

	// Validate plan
	const validatePlan = useCallback(async () => {
		setIsValidating(true);
		setValidationResults(null);
		
		// Simulate validation
		await new Promise((resolve) => setTimeout(resolve, 800));
		
		// Simple validation logic
		let valid = true;
		let message = 'Plan looks good!';
		
		if (operations.length === 0) {
			valid = false;
			message = 'Add at least one operation to the plan';
		}
		
		// Check for conflicts
		const commitOps = operations.filter(op => op.type !== 'rebase_onto');
		const uniqueCommits = new Set(commitOps.map(op => op.commitHash));
		if (uniqueCommits.size < commitOps.length) {
			valid = false;
			message = 'Some commits are referenced multiple times';
		}
		
		setValidationResults({ valid, message });
		setIsValidating(false);
	}, [operations]);

	// Apply plan
	const handleApply = useCallback(() => {
		if (!validationResults?.valid) return;
		
		const plan: RewritePlan = {
			id: `plan-${String(Date.now())}`,
			name: planName,
			sourceBranch,
			baseBranch,
			ops: operations,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			status: 'validated',
		};
		
		onApplyPlan(plan);
		onOpenChange(false);
	}, [validationResults, planName, sourceBranch, baseBranch, operations, onApplyPlan, onOpenChange]);

	// Save draft
	const handleSaveDraft = useCallback(() => {
		const plan: RewritePlan = {
			id: `plan-${String(Date.now())}`,
			name: planName,
			sourceBranch,
			baseBranch,
			ops: operations,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			status: 'draft',
		};
		
		onSaveDraft(plan);
	}, [planName, sourceBranch, baseBranch, operations, onSaveDraft]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className='w-full sm:max-w-2xl flex flex-col gap-0'>
				<SheetHeader className='space-y-1 border-b border-border/60 pb-3'>
					<SheetTitle className='flex items-center gap-2 text-base'>
						<Edit className='h-4 w-4' />
						Rewrite plan editor
					</SheetTitle>
					<p className='text-[11px] text-muted-foreground/85 leading-relaxed'>
						Plan your history changes safely, then apply all at once.
					</p>
				</SheetHeader>

				{/* Plan info */}
				<div className='space-y-2 border-b border-border/60 py-3'>
					<div className='flex items-center gap-2 font-mono text-[11px]'>
						<GitBranch className='h-3.5 w-3.5 text-muted-foreground' />
						<span className='truncate text-foreground/90'>{sourceBranch}</span>
						<span className='text-muted-foreground'>→</span>
						<span className='truncate text-muted-foreground/85'>{baseBranch}</span>
					</div>
					<div className='space-y-1'>
						<label className='text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
							Plan name
						</label>
						<Input
							placeholder='My rewrite plan…'
							value={planName}
							onChange={(e) => { setPlanName(e.target.value); }}
						/>
					</div>
				</div>

				{/* Operations list */}
				<div className='flex flex-1 flex-col overflow-hidden py-3'>
					<div className='mb-2 flex items-center justify-between'>
						<h3 className='text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
							Plan steps {operations.length > 0 && (
								<span className='ml-1.5 font-mono tabular-nums text-muted-foreground/70'>{operations.length}</span>
							)}
						</h3>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant='outline' size='sm'>
									<Plus className='mr-1 h-3.5 w-3.5' />
									Add step
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end' className='w-56'>
								{Object.entries(OP_CONFIG).map(([type, config]) => (
									<DropdownMenuItem
										key={type}
										onClick={() => { addOperation(type as RewriteOpType); }}
										className='items-start gap-2 px-2 py-1.5'>
										<config.icon className={cn('mt-0.5 h-4 w-4', config.color)} />
										<div className='flex flex-col leading-snug'>
											<span className='text-[0.8125rem] font-medium'>{config.label}</span>
											<span className='text-[11px] text-muted-foreground/85'>{config.description}</span>
										</div>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<ScrollArea className='-mx-1 flex-1 px-1'>
						{operations.length === 0 ? (
							<div className='py-10 text-center'>
								<GitCommit className='mx-auto mb-3 h-10 w-10 text-muted-foreground/40' />
								<p className='text-[0.8125rem] font-medium text-foreground/85'>No steps yet</p>
								<p className='mt-1 text-[11px] text-muted-foreground/85'>
									Add drops, reorders, squashes, or rewords to begin.
								</p>
							</div>
						) : (
							<div className='space-y-1.5'>
								{operations.map((op, index) => (
									<RewriteOpItem
										key={op.id}
										op={op}
										index={index}
										total={operations.length}
										onUpdate={(updates) => { updateOperation(op.id, updates); }}
										onRemove={() => { removeOperation(op.id); }}
										onMoveUp={() => { moveOperation(op.id, 'up'); }}
										onMoveDown={() => { moveOperation(op.id, 'down'); }}
									/>
								))}
							</div>
						)}
					</ScrollArea>
				</div>

				{/* Validation & actions */}
				<div className='space-y-2.5 border-t border-border/60 pt-3'>
					{validationResults && (
						<div className={cn(
							'ui-banner flex items-center gap-2',
							validationResults.valid ? 'ui-banner-info' : 'ui-banner-error'
						)}>
							{validationResults.valid ? (
								<CheckCircle2 className='h-4 w-4 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />
							) : (
								<XCircle className='h-4 w-4 text-destructive' />
							)}
							<span className='text-[0.8125rem]'>{validationResults.message}</span>
						</div>
					)}

					<div className='flex items-center gap-2'>
						<Button
							variant='outline'
							size='sm'
							onClick={() => { void validatePlan(); }}
							disabled={isValidating}
							className='flex-1'>
							{isValidating ? (
								<RotateCcw className='mr-1.5 h-3.5 w-3.5 animate-spin' />
							) : (
								<Eye className='mr-1.5 h-3.5 w-3.5' />
							)}
							Validate
						</Button>
						<Button
							variant='outline'
							size='sm'
							onClick={handleSaveDraft}
							className='flex-1'>
							<Save className='mr-1.5 h-3.5 w-3.5' />
							Save draft
						</Button>
						<Button
							size='sm'
							onClick={handleApply}
							disabled={!validationResults?.valid}
							className='flex-1'>
							<Play className='mr-1.5 h-3.5 w-3.5' />
							Apply plan
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}

// Single operation item
function RewriteOpItem({
	op,
	index,
	total,
	onUpdate,
	onRemove,
	onMoveUp,
	onMoveDown,
}: {
	op: RewriteOp;
	index: number;
	total: number;
	onUpdate: (updates: Partial<RewriteOp>) => void;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
}) {
	const config = OP_CONFIG[op.type];
	const Icon = config.icon;

	return (
		<div
			className={cn(
				'group/op relative rounded-lg border border-border/70 bg-card/50 p-2.5 transition-colors',
				!op.isValid && 'border-destructive/50 bg-[color-mix(in_oklch,var(--destructive)_5%,transparent)]'
			)}>
			<div className='flex items-start gap-2'>
				{/* Reorder handle */}
				<div className='flex flex-col gap-0.5 pt-0.5'>
					<Button
						variant='ghost'
						size='xs'
						className='h-4 w-4 p-0 text-muted-foreground/85 hover:text-foreground'
						onClick={onMoveUp}
						disabled={index === 0}>
						<ArrowUp className='h-3 w-3' />
					</Button>
					<Button
						variant='ghost'
						size='xs'
						className='h-4 w-4 p-0 text-muted-foreground/85 hover:text-foreground'
						onClick={onMoveDown}
						disabled={index === total - 1}>
						<ArrowDown className='h-3 w-3' />
					</Button>
				</div>

				<span className='mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-muted/60 font-mono text-[10px] tabular-nums text-muted-foreground/85'>
					{index + 1}
				</span>

				<div className='min-w-0 flex-1'>
					<div className='mb-1 flex flex-wrap items-center gap-2'>
						<Badge variant='outline' className={cn('gap-1', config.color)}>
							<Icon className='h-3 w-3' />
							{config.label}
						</Badge>
						{op.commitHash && (
							<span className='font-mono text-[11px] tabular-nums text-muted-foreground/85'>
								{op.commitHash.substring(0, 7)}
							</span>
						)}
					</div>

					{op.type === 'reword' ? (
						<Textarea
							value={op.message}
							onChange={(e) => { onUpdate({ message: e.target.value }); }}
							placeholder='New commit message…'
							className='h-16 text-[0.8125rem]'
						/>
					) : op.type === 'cherry-pick' || op.type === 'move' ? (
						<Input
							value={op.target || ''}
							onChange={(e) => { onUpdate({ target: e.target.value }); }}
							placeholder='Target branch…'
							className='font-mono text-[0.8125rem]'
						/>
					) : (
						<p className='truncate text-[0.8125rem] text-muted-foreground/85'>
							{op.message || config.description}
						</p>
					)}

					{!op.isValid && op.validationMessage && (
						<p className='mt-1.5 text-[11px] text-destructive'>{op.validationMessage}</p>
					)}
				</div>

				<Button
					variant='ghost'
					size='xs'
					className='h-7 w-7 p-0 text-muted-foreground/85 hover:bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)] hover:text-destructive'
					onClick={onRemove}
					aria-label='Remove step'>
					<Trash2 className='h-3.5 w-3.5' />
				</Button>
			</div>
		</div>
	);
}

// Need to import DropdownMenu
