/**
 * Quick Look Integration
 * macOS Quick Look preview for files in commits
 */

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	Eye,
	FileImage,
	FileText,
	FileCode,
	File,
	Loader2,
	ZoomIn,
	ZoomOut,
	RotateCw,
	Download,
	X,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickLookPreviewProps {
	filePath: string;
	commitHash?: string;
	onClose?: () => void;
}

interface QuickLookState {
	isOpen: boolean;
	filePath: string;
	commitHash: string;
	content: string | null;
	isImage: boolean;
	imageData: string | null;
	isLoading: boolean;
	zoom: number;
	rotation: number;
}

// Global state for Quick Look
let quickLookState: QuickLookState = {
	isOpen: false,
	filePath: '',
	commitHash: '',
	content: null,
	isImage: false,
	imageData: null,
	isLoading: false,
	zoom: 1,
	rotation: 0,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function notify() {
	listeners.forEach(l => l());
}

function updateState(newState: Partial<QuickLookState>) {
	quickLookState = { ...quickLookState, ...newState };
	notify();
}

// Check if file is an image
function isImageFile(path: string): boolean {
	const ext = path.split('.').pop()?.toLowerCase() || '';
	return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
}

// Get file type icon
function getFileIcon(path: string) {
	const ext = path.split('.').pop()?.toLowerCase() || '';
	
	const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'swift', 'kt'];
	const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
	
	if (imageExtensions.includes(ext)) return FileImage;
	if (codeExtensions.includes(ext)) return FileCode;
	if (['md', 'txt', 'rst', 'log'].includes(ext)) return FileText;
	return File;
}

// Hook to use Quick Look state
export function useQuickLook() {
	const [, forceUpdate] = useState({});

	useEffect(() => {
		return subscribe(() => forceUpdate({}));
	}, []);

	const openQuickLook = useCallback(async (filePath: string, commitHash: string = 'HEAD') => {
		const { activeRepo } = useAppStore.getState();
		if (!activeRepo) return;

		updateState({
			isOpen: true,
			filePath,
			commitHash,
			content: null,
			isImage: isImageFile(filePath),
			imageData: null,
			isLoading: true,
			zoom: 1,
			rotation: 0,
		});

		try {
			if (isImageFile(filePath)) {
				// For images, get base64 data
				const result = await trpc.git.showFile.query({
					repo: activeRepo,
					commitHash,
					filePath,
				});
				updateState({
					imageData: result,
					isLoading: false,
				});
			} else {
				// For text files, get content
				const result = await trpc.git.showFile.query({
					repo: activeRepo,
					commitHash,
					filePath,
				});
				updateState({
					content: result,
					isLoading: false,
				});
			}
		} catch (error) {
			toast.error('Failed to load file preview');
			updateState({
				isOpen: false,
				isLoading: false,
			});
		}
	}, []);

	const closeQuickLook = useCallback(() => {
		updateState({
			isOpen: false,
			filePath: '',
			content: null,
			imageData: null,
		});
	}, []);

	const setZoom = useCallback((zoom: number) => {
		updateState({ zoom: Math.max(0.1, Math.min(5, zoom)) });
	}, []);

	const setRotation = useCallback((rotation: number) => {
		updateState({ rotation });
	}, []);

	return {
		...quickLookState,
		openQuickLook,
		closeQuickLook,
		setZoom,
		setRotation,
	};
}

// Quick Look button component
export function QuickLookButton({
	filePath,
	commitHash = 'HEAD',
	size = 'sm',
}: {
	filePath: string;
	commitHash?: string;
	size?: 'sm' | 'md' | 'lg';
}) {
	const { openQuickLook } = useQuickLook();

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size={size === 'sm' ? 'sm' : size === 'md' ? 'default' : 'lg'}
					className="h-6 w-6 p-0"
					onClick={(e) => {
						e.stopPropagation();
						openQuickLook(filePath, commitHash);
					}}
				>
					<Eye className="h-3.5 w-3.5" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Quick Look</TooltipContent>
		</Tooltip>
	);
}

// Quick Look panel component
export function QuickLookPanel() {
	const {
		isOpen,
		filePath,
		content,
		isImage,
		imageData,
		isLoading,
		zoom,
		rotation,
		closeQuickLook,
		setZoom,
		setRotation,
	} = useQuickLook();

	if (!isOpen) return null;

	const FileIcon = getFileIcon(filePath);

	return (
		<div
			className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
			onClick={closeQuickLook}
		>
			<div
				className="ui-surface max-w-5xl max-h-[90vh] w-full mx-4 overflow-hidden flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="ui-toolbar flex items-center justify-between px-4 py-3">
					<div className="flex items-center gap-3">
						<FileIcon className="h-5 w-5 text-muted-foreground" />
						<span className="font-medium truncate">{filePath.split('/').pop()}</span>
					</div>
					<div className="flex items-center gap-2">
						{isImage && (
							<>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setZoom(zoom - 0.25)}
									disabled={zoom <= 0.25}
								>
									<ZoomOut className="h-4 w-4" />
								</Button>
								<span className="text-sm text-muted-foreground w-12 text-center">
									{Math.round(zoom * 100)}%
								</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setZoom(zoom + 0.25)}
									disabled={zoom >= 5}
								>
									<ZoomIn className="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setRotation(rotation + 90)}
								>
									<RotateCw className="h-4 w-4" />
								</Button>
							</>
						)}
						<Button variant="ghost" size="sm" onClick={closeQuickLook}>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-auto flex items-center justify-center p-4">
					{isLoading ? (
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					) : isImage ? (
						<img
							src={imageData || ''}
							alt={filePath}
							className="max-w-full max-h-full object-contain transition-transform"
							style={{
								transform: `scale(${zoom}) rotate(${rotation}deg)`,
							}}
						/>
					) : (
						<pre className="font-mono text-sm p-4 bg-muted/50 rounded-lg overflow-auto max-w-full max-h-full whitespace-pre-wrap">
							{content || 'Unable to preview this file'}
						</pre>
					)}
				</div>

				{/* Footer */}
				<div className="ui-toolbar px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
					<span>{filePath}</span>
					<div className="flex items-center gap-4">
						<span>Press ESC or click outside to close</span>
					</div>
				</div>
			</div>
		</div>
	);
}

// Keyboard shortcut handler
export function useQuickLookKeyboard() {
	const { isOpen, closeQuickLook, setZoom, zoom } = useQuickLook();

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isOpen) return;

			switch (e.key) {
				case 'Escape':
					closeQuickLook();
					break;
				case '+':
				case '=':
					if (e.metaKey || e.ctrlKey) {
						e.preventDefault();
						setZoom(zoom + 0.25);
					}
					break;
				case '-':
					if (e.metaKey || e.ctrlKey) {
						e.preventDefault();
						setZoom(zoom - 0.25);
					}
					break;
				case '0':
					if (e.metaKey || e.ctrlKey) {
						e.preventDefault();
						setZoom(1);
					}
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, closeQuickLook, setZoom, zoom]);
}

export default QuickLookPanel;
