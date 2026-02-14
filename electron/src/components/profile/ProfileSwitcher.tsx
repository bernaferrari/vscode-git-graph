/**
 * Profile Switcher Component
 * Allows users to switch between different Git profiles
 */

import { useProfiles, type GitProfile } from '@/lib/profiles';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
	blue: 'border-blue-500/30 bg-blue-500/10 text-blue-500',
	green: 'border-green-500/30 bg-green-500/10 text-green-500',
	purple: 'border-purple-500/30 bg-purple-500/10 text-purple-500',
	orange: 'border-orange-500/30 bg-orange-500/10 text-orange-500',
	red: 'border-red-500/30 bg-red-500/10 text-red-500',
	cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-500',
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
					variant="outline"
					size="sm"
					className={cn(
						'h-8 gap-1.5 border-dashed',
						activeProfile && PROFILE_COLORS[activeProfile.color],
						className
					)}
				>
					<ActiveIcon className="h-4 w-4" />
					<span>{activeProfile?.name || 'Select Profile'}</span>
					<ChevronDown className="h-3 w-3 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				<div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
					Git Profiles
				</div>
				<DropdownMenuSeparator />
				{profiles.map((profile) => {
					const Icon = PROFILE_ICONS[profile.icon] || User;
					const isActive = profile.id === activeProfileId;
					return (
						<DropdownMenuItem
							key={profile.id}
							onClick={() => setActiveProfile(profile.id)}
							className={cn('flex items-center gap-2 cursor-pointer', isActive && 'bg-accent')}
						>
							<Icon
								className={cn(
									'h-4 w-4',
									isActive ? 'opacity-100' : 'opacity-50'
								)}
							/>
							<div className="flex flex-col flex-1">
								<span className="font-medium">{profile.name}</span>
								{profile.userEmail && (
									<span className="text-xs text-muted-foreground truncate">
										{profile.userEmail}
									</span>
								)}
							</div>
							{isActive && <Check className="h-4 w-4 ml-auto" />}
						</DropdownMenuItem>
					);
				})}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleAddProfile} className="cursor-pointer">
					<Plus className="h-4 w-4 mr-2" />
					Add Profile
				</DropdownMenuItem>
				<DropdownMenuItem className="cursor-pointer">
					<Settings className="h-4 w-4 mr-2" />
					Manage Profiles
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
