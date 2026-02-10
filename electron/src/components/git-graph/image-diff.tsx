/**
 * Image Diff Viewer
 * Visual comparison for image files
 */

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	ZoomIn,
	ZoomOut,
	Maximize2,
	ImageOff,
	Columns,
	Square,
	Eye,
} from 'lucide-react';

interface ImageDiffProps {
	file: {
		path: string;
		oldPath?: string;
		status: string;
	};
	commitHash: string;
	oldCommitHash?: string;
}

export function ImageDiff({ file, commitHash, oldCommitHash }: ImageDiffProps) {
	const { activeRepo } = useAppStore();
	const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay' | 'swipe'>('side-by-side');
	const [zoom, setZoom] = useState(100);
	const [overlayOpacity, setOverlayOpacity] = useState(50);

	// In a real app, we'd get these URLs from the backend
	// For now, use placeholder logic
	const getImageUrl = (repo: string, commit: string, path: string) => {
		// This would be a real endpoint to fetch image content
		return `git-image://${repo}/${commit}/${path}`;
	};

	const currentUrl = activeRepo && commitHash && file.path
		? getImageUrl(activeRepo, commitHash, file.path)
		: null;

	const oldUrl = activeRepo && oldCommitHash && (file.oldPath || file.path)
		? getImageUrl(activeRepo, oldCommitHash, file.oldPath || file.path)
		: null;

	const isNewFile = file.status === 'A';
	const isDeleted = file.status === 'D';

	const handleZoomIn = () => setZoom(Math.min(zoom + 25, 400));
	const handleZoomOut = () => setZoom(Math.max(zoom - 25, 25));
	const handleFit = () => setZoom(100);

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
							<TabsTrigger value="overlay" className="text-xs h-5 px-2">
								<Eye className="h-3 w-3 mr-1" />
								Overlay
							</TabsTrigger>
							<TabsTrigger value="swipe" className="text-xs h-5 px-2">
								<Square className="h-3 w-3 mr-1" />
								Swipe
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<div className="flex items-center gap-1 border-l pl-2 ml-2">
						<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleZoomOut}>
							<ZoomOut className="h-3 w-3" />
						</Button>
						<span className="text-xs w-10 text-center">{zoom}%</span>
						<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleZoomIn}>
							<ZoomIn className="h-3 w-3" />
						</Button>
						<Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleFit}>
							<Maximize2 className="h-3 w-3" />
						</Button>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-auto bg-muted/20 p-4">
				{viewMode === 'side-by-side' && (
					<div className="flex gap-4 h-full">
						{!isNewFile && (
							<div className="flex-1 flex flex-col">
								<div className="text-xs text-muted-foreground mb-2 text-center">
									Old ({oldCommitHash?.slice(0, 7)})
								</div>
								<div className="flex-1 flex items-center justify-center border rounded bg-background">
									{oldUrl ? (
										<img
											src={oldUrl}
											alt="Old version"
											style={{ maxWidth: `${zoom}%`, maxHeight: '100%', objectFit: 'contain' }}
											className="rounded"
											onError={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
									) : (
										<div className="flex flex-col items-center text-muted-foreground">
											<ImageOff className="h-8 w-8 mb-2" />
											<span className="text-xs">Image not available</span>
										</div>
									)}
								</div>
							</div>
						)}
						{!isDeleted && (
							<div className="flex-1 flex flex-col">
								<div className="text-xs text-muted-foreground mb-2 text-center">
									New ({commitHash.slice(0, 7)})
								</div>
								<div className="flex-1 flex items-center justify-center border rounded bg-background">
									{currentUrl ? (
										<img
											src={currentUrl}
											alt="New version"
											style={{ maxWidth: `${zoom}%`, maxHeight: '100%', objectFit: 'contain' }}
											className="rounded"
											onError={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
									) : (
										<div className="flex flex-col items-center text-muted-foreground">
											<ImageOff className="h-8 w-8 mb-2" />
											<span className="text-xs">Image not available</span>
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				)}

				{viewMode === 'overlay' && !isNewFile && !isDeleted && (
					<div className="flex flex-col h-full">
						<div className="flex items-center gap-4 mb-4">
							<span className="text-xs text-muted-foreground">Opacity (Old):</span>
							<input
								type="range"
								min="0"
								max="100"
								value={overlayOpacity}
								onChange={(e) => setOverlayOpacity(parseInt(e.target.value))}
								className="w-32"
							/>
							<span className="text-xs">{overlayOpacity}%</span>
						</div>
						<div className="flex-1 relative flex items-center justify-center border rounded bg-background">
							{currentUrl && (
								<img
									src={currentUrl}
									alt="New version"
									style={{ maxWidth: `${zoom}%`, maxHeight: '100%', objectFit: 'contain' }}
									className="absolute rounded"
								/>
							)}
							{oldUrl && (
								<img
									src={oldUrl}
									alt="Old version"
									style={{
										maxWidth: `${zoom}%`,
										maxHeight: '100%',
										objectFit: 'contain',
										opacity: overlayOpacity / 100,
									}}
									className="absolute rounded"
								/>
							)}
						</div>
					</div>
				)}

				{viewMode === 'swipe' && !isNewFile && !isDeleted && (
					<div className="flex flex-col h-full">
						<div className="text-xs text-muted-foreground mb-2">
							Drag to compare (simulated - actual swipe requires more complex implementation)
						</div>
						<div className="flex-1 relative flex items-center justify-center border rounded bg-background overflow-hidden">
							{/* This is a simplified version - a full swipe implementation would use a slider */}
							<div className="absolute inset-0 flex">
								<div className="w-1/2 overflow-hidden flex items-center justify-center">
									{oldUrl && (
										<img
											src={oldUrl}
											alt="Old version"
											style={{ maxWidth: `${zoom * 2}%`, maxHeight: '100%', objectFit: 'contain' }}
											className="rounded"
										/>
									)}
								</div>
								<div className="w-px bg-border" />
								<div className="w-1/2 overflow-hidden flex items-center justify-center">
									{currentUrl && (
										<img
											src={currentUrl}
											alt="New version"
											style={{ maxWidth: `${zoom * 2}%`, maxHeight: '100%', objectFit: 'contain' }}
											className="rounded"
										/>
									)}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
