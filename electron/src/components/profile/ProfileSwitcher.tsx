/**
 * Profile Switcher Component
 * Allows users to switch between different Git profiles
 */

import {
	User,
	Briefcase,
	Home,
	Heart,
	Code2,
	Shield,
	Plus,
	Settings,
	ChevronDown,
	Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProfiles, type GitProfile } from '@/lib/profiles';
import { cn } from '@/lib/utils';

const PROFILE_ICONS: Record<string, React.ElementType> = {
	User,
	Briefcase,
	Home,
	Heart,
	Code2,
	Shield,
};

const PROFILE_COLORS: Record<string, string> = {
	blue:
		'border-[color-mix(in_oklch,var(--info)_35%,transparent)] bg-[color-mix(in_oklch,var(--info)_10%,transparent)] text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',
	green:
		'border-[color-mix(in_oklch,var(--success)_35%,transparent)] bg-[color-mix(in_oklch,var(--success)_10%,transparent)] text-[color-mix(in_oklch,var(--success)_70%,var(--foreground))]',
	purple:
		'border-[color-mix(in_oklch,var(--primary)_35%,transparent)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]',
	orange:
		'border-[color-mix(in_oklch,var(--warning)_38%,transparent)] bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]',
	red:
		'border-[color-mix(in_oklch,var(--destructive)_35%,transparent)] bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] text-[color-mix(in_oklch,var(--destructive)_72%,var(--foreground))]',
	cyan:
		'border-[color-mix(in_oklch,var(--chart-7)_35%,transparent)] bg-[color-mix(in_oklch,var(--chart-7)_10%,transparent)] text-[color-mix(in_oklch,var(--chart-7)_75%,var(--foreground))]',
};

interface ProfileSwitcherProps {
	className?: string;
}

export function ProfileSwitcher({ className }: ProfileSwitcherProps) {
	const { profiles, activeProfileId, setActiveProfile, addProfile, getActiveProfile } =
		useProfiles();

	const activeProfile = getActiveProfile();
	const ActiveIcon = activeProfile
		? PROFILE_ICONS[activeProfile.icon] || User
		: User;

	const handleAddProfile = () => {
		const newProfile: Omit<GitProfile, 'id'> = {
			name: 'New Profile',
			icon: 'User',
			color: 'blue',
			userName: '',
			userEmail: '',
			signingKey: '',
			defaultRemote: 'origin',
			defaultLensMode: 'craft',
			preferredMergeStrategy: 'merge',
			autoFetchOnStartup: true,
			confirmBeforePush: false,
		};
		addProfile(newProfile);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='outline'
					size='sm'
					className={cn(
						'h-8 gap-1.5',
						activeProfile && PROFILE_COLORS[activeProfile.color],
						className
					)}>
					<ActiveIcon className='h-4 w-4' />
					<span className='font-medium'>{activeProfile?.name || 'Select profile'}</span>
					<ChevronDown className='h-3 w-3 opacity-60' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start' className='w-64'>
				<div className='px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/85'>
					Git profiles
				</div>
				<DropdownMenuSeparator />
				{profiles.map((profile) => {
					const Icon = PROFILE_ICONS[profile.icon] || User;
					const isActive = profile.id === activeProfileId;
					return (
						<DropdownMenuItem
							key={profile.id}
							onClick={() => { setActiveProfile(profile.id); }}
							className={cn('flex cursor-pointer items-start gap-2 px-2 py-1.5', isActive && 'bg-accent/70')}>
							<Icon className={cn('mt-0.5 h-4 w-4', isActive ? 'opacity-100' : 'opacity-60')} />
							<div className='flex min-w-0 flex-1 flex-col leading-snug'>
								<span className='truncate text-[0.8125rem] font-medium'>{profile.name}</span>
								{profile.userEmail && (
									<span className='truncate font-mono text-[11px] text-muted-foreground/85'>
										{profile.userEmail}
									</span>
								)}
							</div>
							{isActive && <Check className='ml-auto mt-0.5 h-3.5 w-3.5 text-primary' />}
						</DropdownMenuItem>
					);
				})}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleAddProfile} className='cursor-pointer'>
					<Plus className='mr-2 h-3.5 w-3.5' />
					Add profile
				</DropdownMenuItem>
				<DropdownMenuItem className='cursor-pointer'>
					<Settings className='mr-2 h-3.5 w-3.5' />
					Manage profiles
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
