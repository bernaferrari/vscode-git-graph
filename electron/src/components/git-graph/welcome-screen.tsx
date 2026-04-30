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
        <div className='ui-reveal flex flex-1 flex-col items-center justify-center overflow-auto p-8'>
            <div className='w-full max-w-5xl space-y-6'>
                <div className='flex items-center justify-center gap-3'>
                    <div className='from-primary to-primary/60 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg'>
                        <GitBranch className='text-primary-foreground h-8 w-8' />
                    </div>
                </div>
                <HomeStartSurface
                    mode='hero'
                    title='Welcome to Git Graph'
                    description='Open a repository, resume recent work, and move straight into branch state and commit review without a stack of onboarding dead ends.'
                    primaryActionLabel='Open Repository'
                    primaryActionBusyLabel='Opening…'
                    isPrimaryActionBusy={isRepoLoading}
                    onPrimaryAction={() => { void handleOpenRepo(); }}
                    recentRepos={[]}
                    openedRepos={[]}
                    onActivateRepo={() => {}}
                    footerHint='Once a repository is open, use ? for keyboard help, Cmd+K for fuzzy finder, and Cmd+Shift+P for the command palette.'
                />
            </div>
        </div>
    );
}

export default WelcomeScreen;
