/**
 * Avatar Service
 * Fetch author avatars from Gravatar, GitHub, etc.
 */

import { useState, useEffect, useMemo } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarProps {
	email?: string;
	name?: string;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
}

// Cache for avatars to avoid repeated lookups
const avatarCache = new Map<string, string>();

// Generate Gravatar URL
function getGravatarUrl(email: string, size: number = 40): string {
	const hash = email.trim().toLowerCase();
	// Simple hash simulation - in production, use proper MD5
	const cacheKey = `gravatar-${hash}-${size}`;
	
	if (avatarCache.has(cacheKey)) {
		return avatarCache.get(cacheKey)!;
	}
	
	// For now, use a placeholder - in production, would use actual Gravatar API
	// const hashedEmail = md5(hash);
	// const url = `https://www.gravatar.com/avatar/${hashedEmail}?s=${size}&d=retro`;
	
	// Use UI Avatars as fallback
	const name = email.split('@')[0];
	const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size}&background=random&bold=true`;
	
	avatarCache.set(cacheKey, url);
	return url;
}

// Get GitHub avatar from username
function getGitHubAvatar(username: string, size: number = 40): string {
	return `https://avatars.githubusercontent.com/${username}?size=${size}`;
}

// Extract GitHub username from email (common patterns)
function extractGitHubUsername(email: string): string | null {
	// Pattern: username@users.noreply.github.com
	const githubMatch = email.match(/^(.+)@users\.noreply\.github\.com$/);
	if (githubMatch) {
		return githubMatch[1];
	}
	
	// Pattern: username@github.com
	const githubMatch2 = email.match(/^(.+)@github\.com$/);
	if (githubMatch2) {
		return githubMatch2[1];
	}
	
	return null;
}

const sizeMap = {
	sm: 24,
	md: 32,
	lg: 48,
};

export function Avatar({ email, name, size = 'md', className }: AvatarProps) {
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const [hasError, setHasError] = useState(false);

	const pixelSize = sizeMap[size];

	useEffect(() => {
		if (!email && !name) {
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

		// Fall back to Gravatar or UI Avatars
		if (email) {
			setImageUrl(getGravatarUrl(email, pixelSize * 2));
		} else if (name) {
			setImageUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${pixelSize * 2}&background=random&bold=true`);
		}
	}, [email, name, pixelSize]);

	if (hasError || !imageUrl) {
		return (
			<div
				className={cn(
					"rounded-full bg-muted flex items-center justify-center",
					className
				)}
				style={{ width: pixelSize, height: pixelSize }}
			>
				<User
					className="text-muted-foreground"
					style={{ width: pixelSize * 0.6, height: pixelSize * 0.6 }}
				/>
			</div>
		);
	}

	return (
		<img
			src={imageUrl}
			alt={name || email || 'Avatar'}
			className={cn("rounded-full object-cover", className)}
			style={{ width: pixelSize, height: pixelSize }}
			onError={() => setHasError(true)}
		/>
	);
}

// Avatar with tooltip showing full name and email
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';

export function AvatarWithTooltip({ email, name, size = 'md', className }: AvatarProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span>
					<Avatar email={email} name={name} size={size} className={className} />
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
						email={author.email}
						name={author.name}
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
