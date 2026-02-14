/**
 * Side-by-Side Diff Viewer
 * Powered by Pierre Diffs (https://diffs.com)
 */

import { useState, useMemo } from 'react';
import { PatchDiff } from '@pierre/diffs/react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	AlignLeft,
	Columns,
	Copy,
	Check,
	Plus,
	Minus,
} from 'lucide-react';

interface SideBySideDiffProps {
	file: {
		path: string;
		from?: string;
		status: string;
	};
	commitHash?: string;
	onAcceptOurs?: () => void;
	onAcceptTheirs?: () => void;
}

export function SideBySideDiff({ file, commitHash, onAcceptOurs, onAcceptTheirs }: SideBySideDiffProps) {
	const { activeRepo } = useAppStore();
	const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
	const [copied, setCopied] = useState(false);

	const { data: diffData, isLoading } = trpc.git.fileDiff.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: commitHash ?? 'HEAD',
			filePath: file.path,
		},
		{ enabled: !!activeRepo && !!file.path }
	);

	const diffOptions = useMemo(
		() => ({
			diffStyle: viewMode === 'side-by-side' ? ('split' as const) : ('unified' as const),
			lineDiffType: 'word' as const,
			overflow: 'scroll' as const,
			themeType: 'system' as const,
			disableFileHeader: true,
		}),
		[viewMode]
	);

	const handleCopy = () => {
		navigator.clipboard.writeText(diffData?.diff ?? '');
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium truncate max-w-[200px]">
						{file.path}
					</span>
					<span className="text-xs px-1.5 py-0.5 rounded bg-muted">
						{file.status}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
						<TabsList className="h-7">
							<TabsTrigger value="side-by-side" className="text-xs h-5 px-2">
								<Columns className="h-3 w-3 mr-1" />
								Split
							</TabsTrigger>
							<TabsTrigger value="unified" className="text-xs h-5 px-2">
								<AlignLeft className="h-3 w-3 mr-1" />
								Unified
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopy}>
						{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
					</Button>
					{file.status === 'U' && (
						<>
							<Button variant="outline" size="sm" className="h-7 px-2" onClick={onAcceptOurs}>
								<Minus className="h-3 w-3 mr-1" />
								Ours
							</Button>
							<Button variant="outline" size="sm" className="h-7 px-2" onClick={onAcceptTheirs}>
								<Plus className="h-3 w-3 mr-1" />
								Theirs
							</Button>
						</>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-hidden">
				{isLoading ? (
					<div className="h-full flex items-center justify-center">
						<div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
					</div>
				) : diffData?.diff ? (
					<PatchDiff patch={diffData.diff} options={diffOptions} className="h-full w-full" />
				) : (
					<div className="h-full flex items-center justify-center text-sm text-muted-foreground">
						No diff available
					</div>
				)}
			</div>
		</div>
	);
}
