/**
 * AI Commit Helper Component
 * Provides AI-powered commit message generation
 */

import {
	Sparkles,
	Check,
	Copy,
	RefreshCw,
	Loader2,
	Lightbulb,
	 Wand2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAIFeatures } from '@/hooks/useAIFeatures';
import { cn } from '@/lib/utils';


interface AICommitHelperProps {
	stagedFiles: string[];
	diff: string;
	onApplyMessage: (message: string) => void;
	className?: string;
}

export function AICommitHelper({
	stagedFiles,
	diff,
	onApplyMessage,
	className,
}: AICommitHelperProps) {
	const {
		isGeneratingMessage,
		generateCommitMessage,
		lastSuggestion,
		isAIEnabled,
		setAIEnabled,
	} = useAIFeatures();

	const [appliedMessage, setAppliedMessage] = useState<string | null>(null);

	const handleGenerate = async () => {
		const suggestion = await generateCommitMessage(stagedFiles, diff);
		if (suggestion) {
			toast.success('AI generated a commit message', {
				description: suggestion.description,
			});
		}
	};

	const handleApply = () => {
		if (lastSuggestion) {
			onApplyMessage(lastSuggestion.message);
			setAppliedMessage(lastSuggestion.message);
			toast.success('Applied AI suggestion');
		}
	};

	const handleCopy = () => {
		if (lastSuggestion) {
			navigator.clipboard.writeText(lastSuggestion.message);
			toast.success('Copied to clipboard');
		}
	};

	if (!isAIEnabled) {
		return (
			<Button
				variant="ghost"
				size="sm"
				onClick={() => { setAIEnabled(true); }}
				className={cn('gap-1.5 text-muted-foreground', className)}
			>
				<Wand2 className="h-4 w-4" />
				<span className="hidden sm:inline">Enable AI</span>
			</Button>
		);
	}

	return (
		<div className={cn('flex items-center gap-2', className)}>
			{isGeneratingMessage ? (
				<Button variant="ghost" size="sm" disabled className="gap-1.5">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span>Generating...</span>
				</Button>
			) : lastSuggestion ? (
				<>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge
								variant="secondary"
								className="gap-1 cursor-pointer hover:bg-secondary/80"
								onClick={handleApply}
							>
								<Sparkles className="h-3 w-3 text-amber-500" />
								<span className="max-w-[150px] truncate">
									{lastSuggestion.message}
								</span>
								{appliedMessage === lastSuggestion.message && (
									<Check className="h-3 w-3 text-green-500" />
								)}
							</Badge>
						</TooltipTrigger>
						<TooltipContent className="w-64">
							<p className="font-medium mb-1">AI Suggestion</p>
							<p className="text-sm text-muted-foreground mb-2">
								{lastSuggestion.description}
							</p>
							<p className="text-xs text-muted-foreground">
								Confidence: {Math.round(lastSuggestion.confidence * 100)}%
							</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={handleApply}
								disabled={!!appliedMessage}
							>
								<Check className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Apply suggestion</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={handleCopy}
							>
								<Copy className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Copy to clipboard</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={handleGenerate}
							>
								<RefreshCw className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Regenerate</TooltipContent>
					</Tooltip>
				</>
			) : (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleGenerate}
							disabled={stagedFiles.length === 0}
							className="gap-1.5"
						>
							<Lightbulb className="h-4 w-4" />
							<span className="hidden sm:inline">AI Message</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						{ stagedFiles.length === 0
							? 'Stage files to generate a commit message'
							: 'Generate commit message with AI'
						}
					</TooltipContent>
				</Tooltip>
			)}

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-7 w-7 p-0 text-muted-foreground"
						onClick={() => { setAIEnabled(false); }}
					>
						<Sparkles className="h-3 w-3" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Disable AI features</TooltipContent>
			</Tooltip>
		</div>
	);
}
