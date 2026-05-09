/**
 * Welcome Screen
 * Displayed when no repository is open
 */

import { GitBranch } from 'lucide-react';

import { HomeStartSurface } from './home-start-surface';
import { useRepoActivation } from '@/hooks/useRepoActivation';

interface WelcomeScreenProps {
    onOpenRepo: () => void | Promise<void>;
}

export function WelcomeScreen({ onOpenRepo }: WelcomeScreenProps) {
    const { isRepoLoading } = useRepoActivation();

    const handleOpenRepo = async () => {
        await Promise.resolve(onOpenRepo());
    };

    return (
        <div className='ui-reveal relative flex flex-1 flex-col items-center justify-center overflow-auto p-8'>
            {/* Soft ambient backdrop */}
            <div
                aria-hidden
                className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_60%_at_50%_-10%,color-mix(in_oklch,var(--primary)_12%,transparent)_0%,transparent_55%)]'
            />
            <div className='w-full max-w-5xl space-y-6'>
                <div className='flex flex-col items-center gap-3'>
                    <div className='relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary)_60%,var(--background))] shadow-[var(--shadow-md)] ring-1 ring-primary/30'>
                        <GitBranch className='h-8 w-8 text-primary-foreground' />
                        <span aria-hidden className='absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20' />
                    </div>
                    <span className='text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/85'>
                        GitLizard
                    </span>
                </div>
                <HomeStartSurface
                    mode='hero'
                    title='Welcome to GitLizard'
                    description='See what every action will do before you do it. Open a repository to pick up where you left off, or start a new one — every change is undoable.'
                    primaryActionLabel='Open repository'
                    primaryActionBusyLabel='Opening…'
                    isPrimaryActionBusy={isRepoLoading}
                    onPrimaryAction={() => { void handleOpenRepo(); }}
                    recentRepos={[]}
                    openedRepos={[]}
                    onActivateRepo={() => {}}
                    footerHint='Press ? for keyboard help, ⌘K for fuzzy find, ⌘⇧P for the command palette.'
                />
            </div>
        </div>
    );
}

export default WelcomeScreen;
