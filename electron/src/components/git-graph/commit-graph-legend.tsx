/**
 * Commit Graph Legend
 * Explain graph visualization elements
 */

import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	GitCommit,
	GitMerge,
	GitBranch,
	Tag,
	User,
	Circle,
	Square,
	Info,
} from 'lucide-react';

interface CommitGraphLegendProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommitGraphLegend({ open, onOpenChange }: CommitGraphLegendProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Info className="h-5 w-5" />
						Graph Legend
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{/* Commit Types */}
					<div>
						<h3 className="text-sm font-medium mb-3">Commit Types</h3>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
									<Circle className="h-4 w-4 text-white" />
								</div>
								<div>
									<span className="text-sm font-medium">Regular Commit</span>
									<p className="text-xs text-muted-foreground">Standard commit with one parent</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
									<GitMerge className="h-4 w-4 text-white" />
								</div>
								<div>
									<span className="text-sm font-medium">Merge Commit</span>
									<p className="text-xs text-muted-foreground">Commit with multiple parents</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
									<GitBranch className="h-4 w-4 text-white" />
								</div>
								<div>
									<span className="text-sm font-medium">Branch Point</span>
									<p className="text-xs text-muted-foreground">Commit where a branch was created</p>
								</div>
							</div>
						</div>
					</div>

					{/* Refs */}
					<div>
						<h3 className="text-sm font-medium mb-3">References</h3>
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								<div className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-medium">
									main
								</div>
								<span className="text-sm text-muted-foreground">Local branch</span>
							</div>
							<div className="flex items-center gap-3">
								<div className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-medium">
									origin/main
								</div>
								<span className="text-sm text-muted-foreground">Remote branch</span>
							</div>
							<div className="flex items-center gap-3">
								<div className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-medium">
									HEAD
								</div>
								<span className="text-sm text-muted-foreground">Current checkout</span>
							</div>
							<div className="flex items-center gap-3">
								<div className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-medium flex items-center gap-1">
									<Tag className="h-3 w-3" />
									v1.0.0
								</div>
								<span className="text-sm text-muted-foreground">Tag</span>
							</div>
						</div>
					</div>

					{/* Line Colors */}
					<div>
						<h3 className="text-sm font-medium mb-3">Branch Colors</h3>
						<p className="text-sm text-muted-foreground mb-3">
							Each branch is assigned a unique color to help track it through the graph.
						</p>
						<div className="flex flex-wrap gap-2">
							{['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500', 'bg-cyan-500'].map((color, i) => (
								<div key={i} className={`w-6 h-2 rounded ${color}`} />
							))}
						</div>
					</div>

					{/* Keyboard Shortcuts */}
					<div>
						<h3 className="text-sm font-medium mb-3">Navigation Tips</h3>
						<div className="space-y-2 text-sm text-muted-foreground">
							<div className="flex items-center justify-between">
								<span>Click commit</span>
								<span>Select and show details</span>
							</div>
							<div className="flex items-center justify-between">
								<span>Right-click commit</span>
								<span>Open context menu</span>
							</div>
							<div className="flex items-center justify-between">
								<span>Double-click</span>
								<span>Expand/collapse details</span>
							</div>
							<div className="flex items-center justify-between">
								<span>j/k or ↑/↓</span>
								<span>Navigate commits</span>
							</div>
						</div>
					</div>
				</div>

				<div className="flex justify-end pt-4 border-t">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default CommitGraphLegend;
