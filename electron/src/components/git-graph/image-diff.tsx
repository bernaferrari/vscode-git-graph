/**
 * Image Diff Viewer
 * Visual comparison for image files
 */

import {
	ZoomIn,
	ZoomOut,
	Maximize2,
	ImageOff,
	Columns,
	Eye,
	Loader2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

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
	const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
	const [zoom, setZoom] = useState(100);
	const [overlayOpacity, setOverlayOpacity] = useState(50);

	const isNewFile = file.status === 'A';
	const isDeleted = file.status === 'D';
	const currentMimeType = useMemo(() => getImageMimeType(file.path), [file.path]);
	const oldMimeType = useMemo(() => getImageMimeType(file.oldPath || file.path), [file.oldPath, file.path]);

	const currentImageQuery = trpc.git.fileBinaryAtRevision.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash,
			filePath: file.path,
		},
		{ enabled: Boolean(activeRepo && commitHash && !isDeleted) }
	);
	const previousImageQuery = trpc.git.fileBinaryAtRevision.useQuery(
		{
			repo: activeRepo ?? '',
			commitHash: oldCommitHash ?? '',
			filePath: file.oldPath || file.path,
		},
		{ enabled: Boolean(activeRepo && oldCommitHash && !isNewFile) }
	);

	const currentUrl = currentImageQuery.data?.contentBase64
		? `data:${currentMimeType};base64,${currentImageQuery.data.contentBase64}`
		: null;
	const oldUrl = previousImageQuery.data?.contentBase64
		? `data:${oldMimeType};base64,${previousImageQuery.data.contentBase64}`
		: null;
	const isLoading = currentImageQuery.isLoading || previousImageQuery.isLoading;
	const hasUnavailableVersion =
		(!isDeleted && !currentUrl && !currentImageQuery.isLoading) ||
		(!isNewFile && oldCommitHash && !oldUrl && !previousImageQuery.isLoading);

	const handleZoomIn = () => { setZoom(Math.min(zoom + 25, 400)); };
	const handleZoomOut = () => { setZoom(Math.max(zoom - 25, 25)); };
	const handleFit = () => { setZoom(100); };

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
					<Tabs value={viewMode} onValueChange={(v) => { setViewMode(v as typeof viewMode); }}>
						<TabsList className="h-7">
							<TabsTrigger value="side-by-side" className="text-xs h-5 px-2">
								<Columns className="h-3 w-3 mr-1" />
								Split
							</TabsTrigger>
							<TabsTrigger value="overlay" className="text-xs h-5 px-2">
								<Eye className="h-3 w-3 mr-1" />
								Overlay
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
				{isLoading && (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<div className="flex items-center gap-2 text-sm">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading image revision…
						</div>
					</div>
				)}

				{!isLoading && hasUnavailableVersion && (
					<div className="mb-4 rounded-lg border border-border/70 bg-background/75 px-3 py-2 text-xs text-muted-foreground">
						Some image revisions are unavailable for this change. That usually means the file did not exist on one side of the diff.
					</div>
				)}

				{!isLoading && viewMode === 'side-by-side' && (
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
											style={{ maxWidth: `${String(zoom)}%`, maxHeight: '100%', objectFit: 'contain' }}
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
											style={{ maxWidth: `${String(zoom)}%`, maxHeight: '100%', objectFit: 'contain' }}
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

				{!isLoading && viewMode === 'overlay' && !isNewFile && !isDeleted && (
					<div className="flex flex-col h-full">
						<div className="flex items-center gap-4 mb-4">
							<span className="text-xs text-muted-foreground">Opacity (Old):</span>
							<input
								type="range"
								min="0"
								max="100"
								value={overlayOpacity}
								onChange={(e) => { setOverlayOpacity(parseInt(e.target.value)); }}
								className="w-32"
							/>
							<span className="text-xs">{overlayOpacity}%</span>
						</div>
						<div className="flex-1 relative flex items-center justify-center border rounded bg-background">
							{currentUrl && (
								<img
									src={currentUrl}
									alt="New version"
									style={{ maxWidth: `${String(zoom)}%`, maxHeight: '100%', objectFit: 'contain' }}
									className="absolute rounded"
								/>
							)}
							{oldUrl && (
								<img
									src={oldUrl}
									alt="Old version"
									style={{
										maxWidth: `${String(zoom)}%`,
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
			</div>
		</div>
	);
}

function getImageMimeType(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'svg':
			return 'image/svg+xml';
		case 'bmp':
			return 'image/bmp';
		case 'ico':
			return 'image/x-icon';
		default:
			return 'application/octet-stream';
	}
}
