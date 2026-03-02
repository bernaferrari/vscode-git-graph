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
	AlertTriangle,
	CheckCircle2,
	XCircle,
	Info,
	Sparkles,
	DragIndicator,
	Collapse,
	Expand,
} from 'lucide-react';
import { useState, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
		color: 'text-red-500',
		description: 'Delete this commit entirely',
	},
	reorder: {
		label: 'Rearrange',
		icon: ArrowUp,
		color: 'text-blue-500',
		description: 'Move commit to a different position',
	},
	squash: {
		label: 'Combine',
		icon: Merge,
		color: 'text-purple-500',
		description: 'Merge this commit into previous',
	},
	fixup: {
		label: 'Fix up',
		icon: Edit,
		color: 'text-amber-500',
		description: 'Merge into previous, discard message',
	},
	reword: {
		label: 'Change message',
		icon: Edit,
		color: 'text-cyan-500',
		description: 'Edit commit message',
	},
	'cherry-pick': {
		label: 'Copy to...',
		icon: Copy,
		color: 'text-green-500',
		description: 'Copy this commit to another branch',
	},
	move: {
		label: 'Relocate',
		icon: ArrowUp,
		color: 'text-orange-500',
		description: 'Move to another branch (copy + remove)',
	},
	rebase_onto: {
		label: 'Rebase onto',
		icon: RotateCcw,
		color: 'text-indigo-500',
		description: 'Replay all commits onto new base',
	},
};

export function RewritePlanEditor({
	open,
	onOpenChange,
	sourceBranch,
	baseBranch,
	commits,
	onApplyPlan,
	onSaveDraft,
}: RewritePlanEditorProps) {
	const [planName, setPlanName] = useState('My rewrite plan');
	const [operations, setOperations] = useState<RewriteOp[]>([]);
	const [isValidating, setIsValidating] = useState(false);
	const [validationResults, setValidationResults] = useState<{ valid: boolean; message: string } | null>(null);
	const [showPreview, setShowPreview] = useState(false);

	// Add a new operation
	const addOperation = useCallback((type: RewriteOpType, commit?: { hash: string; message: string }) => {
		const newOp: RewriteOp = {
			id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
			[newOps[index], newOps[newIndex]] = [newOps[newIndex], newOps[index]];
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
			id: `plan-${Date.now()}`,
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
			id: `plan-${Date.now()}`,
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
			<SheetContent className="w-full sm:max-w-2xl flex flex-col">
				<SheetHeader className="mb-4">
					<SheetTitle className="flex items-center gap-2">
						<Edit className="h-5 w-5" />
						Rewrite Plan Editor
					</SheetTitle>
					<p className="text-sm text-muted-foreground">
						Plan your history changes safely, then apply all at once
					</p>
				</SheetHeader>

				{/* Plan Info */}
				<div className="space-y-3 mb-4">
					<div className="flex items-center gap-2">
						<GitBranch className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm">
							<strong>{sourceBranch}</strong>
							<span className="text-muted-foreground"> → {baseBranch}</span>
						</span>
					</div>
					<Input
						placeholder="Plan name..."
						value={planName}
						onChange={(e) => { setPlanName(e.target.value); }}
						className="h-9"
					/>
				</div>

				{/* Operations List */}
				<div className="flex-1 overflow-hidden flex flex-col">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-sm font-medium">Plan Steps</h3>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="sm">
									<Plus className="h-4 w-4 mr-1" />
									Add Step
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								{Object.entries(OP_CONFIG).map(([type, config]) => (
									<DropdownMenuItem
										key={type}
										onClick={() => { addOperation(type as RewriteOpType); }}
									>
										<config.icon className={cn('h-4 w-4 mr-2', config.color)} />
										{config.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<ScrollArea className="flex-1 pr-4">
						{operations.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground">
								<GitCommit className="h-12 w-12 mx-auto mb-3 opacity-30" />
								<p>No operations yet</p>
								<p className="text-xs mt-1">
									Add steps like drop, reorder, or squash commits
								</p>
							</div>
						) : (
							<div className="space-y-2">
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

				{/* Validation & Actions */}
				<div className="border-t pt-4 mt-4 space-y-3">
					{validationResults && (
						<div className={cn(
							'flex items-center gap-2 p-3 rounded-lg',
							validationResults.valid 
								? 'bg-green-50 border border-green-200 dark:bg-green-950/30' 
								: 'bg-red-50 border border-red-200 dark:bg-red-950/30'
						)}>
							{validationResults.valid ? (
								<CheckCircle2 className="h-5 w-5 text-green-600" />
							) : (
								<XCircle className="h-5 w-5 text-red-600" />
							)}
							<span className={cn(
								'text-sm',
								validationResults.valid ? 'text-green-700' : 'text-red-700'
							)}>
								{validationResults.message}
							</span>
						</div>
					)}

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={validatePlan}
							disabled={isValidating}
							className="flex-1"
						>
							{isValidating ? (
								<RotateCcw className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<Eye className="h-4 w-4 mr-2" />
							)}
							Validate
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={handleSaveDraft}
							className="flex-1"
						>
							<Save className="h-4 w-4 mr-2" />
							Save Draft
						</Button>
						<Button
							size="sm"
							onClick={handleApply}
							disabled={!validationResults?.valid}
							className="flex-1"
						>
							<Play className="h-4 w-4 mr-2" />
							Apply Plan
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
		<Card className={cn('transition-colors', !op.isValid && 'border-red-300')}>
			<CardContent className="p-3">
				<div className="flex items-start gap-2">
					{/* Drag handle */}
					<div className="flex flex-col gap-0.5 mt-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-4 w-4 p-0"
							onClick={onMoveUp}
							disabled={index === 0}
						>
							<ArrowUp className="h-3 w-3" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-4 w-4 p-0"
							onClick={onMoveDown}
							disabled={index === total - 1}
						>
							<ArrowDown className="h-3 w-3" />
						</Button>
					</div>

					{/* Operation info */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<Badge variant="outline" className={cn('gap-1', config.color)}>
								<Icon className="h-3 w-3" />
								{config.label}
							</Badge>
							<span className="text-xs font-mono text-muted-foreground">
								{op.commitHash?.substring(0, 7)}
							</span>
						</div>
						
						{op.type === 'reword' ? (
							<Textarea
								value={op.message}
								onChange={(e) => { onUpdate({ message: e.target.value }); }}
								placeholder="New commit message..."
								className="h-16 text-sm"
							/>
						) : op.type === 'cherry-pick' || op.type === 'move' ? (
							<Input
								value={op.target || ''}
								onChange={(e) => { onUpdate({ target: e.target.value }); }}
								placeholder="Target branch..."
								className="h-8 text-sm"
							/>
						) : (
							<p className="text-sm text-muted-foreground truncate">
								{op.message || config.description}
							</p>
						)}

						{!op.isValid && op.validationMessage && (
							<p className="text-xs text-red-500 mt-1">{op.validationMessage}</p>
						)}
					</div>

					{/* Actions */}
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0 text-red-500"
						onClick={onRemove}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

// Need to import DropdownMenu
