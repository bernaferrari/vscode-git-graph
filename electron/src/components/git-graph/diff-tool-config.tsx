/**
 * Diff Tool Configuration
 */

import { useState, useEffect } from 'react';

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
import { trpc } from '@/trpc/client';

const COMMON_DIFF_TOOLS = [
	{ value: 'vscode', label: 'VS Code' },
	{ value: 'code', label: 'VS Code (code)' },
	{ value: 'codium', label: 'VSCodium' },
	{ value: 'meld', label: 'Meld' },
	{ value: 'bcompare', label: 'Beyond Compare' },
	{ value: 'bc3', label: 'Beyond Compare 3' },
	{ value: 'araxis', label: 'Araxis Merge' },
	{ value: 'kdiff3', label: 'KDiff3' },
	{ value: 'tkdiff', label: 'TkDiff' },
	{ value: 'xxdiff', label: 'xxdiff' },
	{ value: 'diffmerge', label: 'DiffMerge' },
	{ value: 'p4merge', label: 'P4Merge' },
	{ value: 'sourcetree', label: 'SourceTree' },
	{ value: 'vimdiff', label: 'VimDiff' },
	{ value: 'emerge', label: 'Emerge (Emacs)' },
];

interface DiffToolConfigProps {
	repo: string;
}

export function DiffToolConfig({ repo }: DiffToolConfigProps) {
	const { data: currentTool } = trpc.git.getDiffTool.useQuery({ repo }, { enabled: !!repo });

	const setToolMutation = trpc.git.setDiffTool.useMutation({
		onSuccess: () => {
			utils.git.getDiffTool.invalidate();
		},
	});

	const utils = trpc.useUtils();

	const [selectedTool, setSelectedTool] = useState('');
	const [customTool, setCustomTool] = useState('');

	useEffect(() => {
		if (currentTool?.tool) {
			const isCommon = COMMON_DIFF_TOOLS.some(t => t.value === currentTool.tool);
			if (isCommon) {
				setSelectedTool(currentTool.tool);
			} else {
				setSelectedTool('custom');
				setCustomTool(currentTool.tool);
			}
		}
	}, [currentTool]);

	const handleSetTool = (global: boolean) => {
		const tool = selectedTool === 'custom' ? customTool : selectedTool;
		if (tool) {
			setToolMutation.mutate({ repo, tool, global });
		}
	};

	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm">Diff Tool</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="space-y-2">
					<Label className="text-xs">Select Tool</Label>
					<Select value={selectedTool} onValueChange={(v) => v && setSelectedTool(v)}>
						<SelectTrigger className="h-8">
							<SelectValue placeholder="Choose a diff tool..." />
						</SelectTrigger>
						<SelectContent>
							{COMMON_DIFF_TOOLS.map((tool) => (
								<SelectItem key={tool.value} value={tool.value}>
									{tool.label}
								</SelectItem>
							))}
							<SelectItem value="custom">Custom...</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{selectedTool === 'custom' && (
					<div className="space-y-2">
						<Label className="text-xs">Custom Tool Command</Label>
						<Input
							value={customTool}
							onChange={(e) => { setCustomTool(e.target.value); }}
							placeholder="e.g., /usr/local/bin/mydiff"
							className="h-8"
						/>
					</div>
				)}

				<div className="flex gap-2">
					<Button
						size="sm"
						onClick={() => { handleSetTool(false); }}
						disabled={!selectedTool || (selectedTool === 'custom' && !customTool)}
					>
						Set for Repo
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => { handleSetTool(true); }}
						disabled={!selectedTool || (selectedTool === 'custom' && !customTool)}
					>
						Set Global
					</Button>
				</div>

				{currentTool?.tool && (
					<p className="text-xs text-muted-foreground">
						Current: <code className="bg-muted px-1 rounded">{currentTool.tool}</code>
					</p>
				)}
			</CardContent>
		</Card>
	);
}
