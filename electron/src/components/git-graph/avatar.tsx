/**
 * Avatar Service
 * Fetch author avatars from Gravatar, GitHub, etc.
 */

import { User } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getGravatarUrl as buildGravatarUrl } from '@/lib/gravatar';
import { cn } from '@/lib/utils';

interface AvatarProps {
	email?: string;
	name?: string;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
}

// Cache for avatars to avoid repeated lookups
const avatarCache = new Map<string, string>();

function getGravatarUrl(email: string, size: number = 40): string {
	const normalizedEmail = email.trim().toLowerCase();
	const cacheKey = `gravatar-${normalizedEmail}-${String(size)}`;
	
	if (avatarCache.has(cacheKey)) {
		return avatarCache.get(cacheKey) ?? '';
	}
	
	const url = buildGravatarUrl(normalizedEmail, size);
	avatarCache.set(cacheKey, url);
	return url;
}

// Get GitHub avatar from username
function getGitHubAvatar(username: string, size: number = 40): string {
	return `https://avatars.githubusercontent.com/${username}?size=${String(size)}`;
}

// Extract GitHub username from email (common patterns)
function extractGitHubUsername(email: string): string | null {
	// Pattern: username@users.noreply.github.com
	const githubMatch = email.match(/^(.+)@users\.noreply\.github\.com$/);
	if (githubMatch) {
		return githubMatch[1] ?? null;
	}
	
	// Pattern: username@github.com
	const githubMatch2 = email.match(/^(.+)@github\.com$/);
	if (githubMatch2) {
		return githubMatch2[1] ?? null;
	}
	
	return null;
}

const sizeMap = {
	sm: 24,
	md: 32,
	lg: 48,
};

function getInitials(value?: string): string {
	if (!value) {
		return '';
	}
	const words = value
		.replace(/@.+$/, '')
		.split(/[\s._-]+/)
		.filter(Boolean);
	return words
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? '')
		.join('');
}

export function Avatar({ email, name, size = 'md', className }: AvatarProps) {
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const [hasError, setHasError] = useState(false);

	const pixelSize = sizeMap[size];
	const initials = getInitials(name ?? email);

	useEffect(() => {
		if (!email) {
			setImageUrl(null);
			return;
		}

		// Try GitHub first if email looks like GitHub
		if (email) {
			const githubUsername = extractGitHubUsername(email);
			if (githubUsername) {
				setImageUrl(getGitHubAvatar(githubUsername, pixelSize * 2));
				return;
			}
		}

		// Fall back to Gravatar; render local initials if the image cannot load.
		setImageUrl(getGravatarUrl(email, pixelSize * 2));
	}, [email, pixelSize]);

	if (hasError || !imageUrl) {
		return (
			<div
				className={cn(
					"rounded-full bg-muted text-muted-foreground flex items-center justify-center font-medium",
					className
				)}
				style={{ width: pixelSize, height: pixelSize }}
			>
				{initials ? (
					<span style={{ fontSize: Math.max(10, pixelSize * 0.38) }}>{initials}</span>
				) : (
					<User
						className="text-muted-foreground"
						style={{ width: pixelSize * 0.6, height: pixelSize * 0.6 }}
					/>
				)}
			</div>
		);
	}

	return (
		<img
			src={imageUrl}
			alt={name || email || 'Avatar'}
			className={cn("rounded-full object-cover", className)}
			style={{ width: pixelSize, height: pixelSize }}
			onError={() => { setHasError(true); }}
		/>
	);
}

export function AvatarWithTooltip({ email, name, size = 'md', className }: AvatarProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span>
					<Avatar
						{...(email !== undefined ? { email } : {})}
						{...(name !== undefined ? { name } : {})}
						size={size}
						{...(className !== undefined ? { className } : {})}
					/>
				</span>
			</TooltipTrigger>
			<TooltipContent>
				<div className="text-center">
					{name && <p className="font-medium">{name}</p>}
					{email && <p className="text-xs text-muted-foreground">{email}</p>}
				</div>
			</TooltipContent>
		</Tooltip>
	);
}

// Multiple avatars stacked (for co-authors, etc.)
interface AvatarStackProps {
	authors: Array<{ name?: string; email?: string }>;
	max?: number;
	size?: 'sm' | 'md' | 'lg';
}

export function AvatarStack({ authors, max = 3, size = 'sm' }: AvatarStackProps) {
	const displayAuthors = authors.slice(0, max);
	const remaining = authors.length - max;
	const pixelSize = sizeMap[size];

	return (
		<div className="flex items-center">
			{displayAuthors.map((author, index) => (
				<div
					key={index}
					className="ring-2 ring-background rounded-full -ml-2 first:ml-0"
					style={{ zIndex: displayAuthors.length - index }}
				>
					<Avatar
						{...(author.email !== undefined ? { email: author.email } : {})}
						{...(author.name !== undefined ? { name: author.name } : {})}
						size={size}
					/>
				</div>
			))}
			{remaining > 0 && (
				<div
					className="ring-2 ring-background rounded-full bg-muted flex items-center justify-center -ml-2 text-xs font-medium"
					style={{ width: pixelSize, height: pixelSize }}
				>
					+{remaining}
				</div>
			)}
		</div>
	);
}

export default Avatar;
