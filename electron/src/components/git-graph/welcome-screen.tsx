/**
 * Welcome Screen
 * Displayed when no repository is open
 */

import { useState, type KeyboardEvent } from 'react';
import { useRepoActivation } from '@/hooks/useRepoActivation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    FolderGit2,
    Github,
    GitBranch,
    Plus,
    Keyboard,
    Shield,
    GitPullRequest,
    Archive,
    Search,
    Loader2,
} from 'lucide-react';

interface WelcomeScreenProps {
    onOpenRepo: () => void | Promise<void>;
}

export function WelcomeScreen({ onOpenRepo }: WelcomeScreenProps) {
    const { openRepositoryDialog, isRepoLoading, isRepoBusy } = useRepoActivation();
    const [loadingAction, setLoadingAction] = useState<'open' | 'clone' | null>(null);

    const handleOpenRepo = async () => {
        if (isRepoBusy) {
            return;
        }
        setLoadingAction('open');
        try {
            await Promise.resolve(onOpenRepo());
        } finally {
            setLoadingAction(null);
        }
    };

    const handleClone = async () => {
        // For now, just open the folder dialog
        // In a full implementation, this would show a clone dialog
        if (isRepoBusy) {
            return;
        }
        setLoadingAction('clone');
        try {
            await openRepositoryDialog('Clone Repository');
        } finally {
            setLoadingAction(null);
        }
    };

    const features = [
        {
            icon: <GitBranch className='h-5 w-5' />,
            title: 'Visual Graph',
            description: 'See your commit history as an interactive graph',
        },
        {
            icon: <GitPullRequest className='h-5 w-5' />,
            title: 'Pull Requests',
            description: 'Create and manage PRs directly from the app',
        },
        {
            icon: <Archive className='h-5 w-5' />,
            title: 'Stash Management',
            description: 'Easy stash, pop, and apply operations',
        },
        {
            icon: <Search className='h-5 w-5' />,
            title: 'Full-Text Search',
            description: 'Search across all commits instantly',
        },
        {
            icon: <Keyboard className='h-5 w-5' />,
            title: 'Keyboard Shortcuts',
            description: 'Navigate and act without leaving the keyboard',
        },
        {
            icon: <Shield className='h-5 w-5' />,
            title: 'Commit Signing',
            description: 'Sign commits with GPG or SSH keys',
        },
    ];

    const quickStarts = [
        {
            icon: <FolderGit2 className='h-8 w-8' />,
            title: 'Open Repository',
            description: 'Open an existing Git repository on your computer',
            action: handleOpenRepo,
            primary: true,
        },
        {
            icon: <Github className='h-8 w-8' />,
            title: 'Clone Repository',
            description: 'Clone a repository from a remote URL',
            action: handleClone,
            primary: false,
        },
    ];

    const handleQuickStartKeyDown = (event: KeyboardEvent, action: () => Promise<void> | void) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void Promise.resolve(action());
        }
    };

    return (
        <div className='ui-reveal flex flex-1 flex-col items-center justify-center overflow-auto p-8'>
            <div className='w-full max-w-4xl space-y-8'>
                {/* Hero */}
                <div className='space-y-4 text-center'>
                    <div className='mb-4 flex items-center justify-center gap-3'>
                        <div className='from-primary to-primary/60 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg'>
                            <GitBranch className='text-primary-foreground h-8 w-8' />
                        </div>
                    </div>
                    <h1 className='text-4xl font-bold tracking-tight'>Welcome to Git Graph</h1>
                    <p className='text-muted-foreground mx-auto max-w-2xl text-lg'>
                        A powerful, GitKraken-style Git client for visualizing and managing your repositories.
                    </p>
                </div>

                {/* Quick Start */}
                <div className='grid gap-4 md:grid-cols-2'>
                    {quickStarts.map((item, index) => (
                        <Card
                            key={index}
                            className={`ui-surface cursor-pointer transition-all hover:shadow-lg ${
                                item.primary
                                    ? 'border-primary/50 hover:border-primary'
                                    : 'hover:border-muted-foreground/30'
                            }`}
                            role='button'
                            tabIndex={0}
                            onClick={item.action}
                            onKeyDown={(event) => handleQuickStartKeyDown(event, item.action)}
                            aria-busy={loadingAction === (item.primary ? 'open' : 'clone')}
                            aria-label={item.title}>
                            <CardHeader className='flex flex-row items-start gap-4 space-y-0 pb-2'>
                                <div
                                    className={`rounded-lg p-2 ${item.primary ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                                    {item.icon}
                                </div>
                                <div className='flex-1'>
                                    <CardTitle className='text-lg'>{item.title}</CardTitle>
                                    <CardDescription>{item.description}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className='pt-0'>
                                <Button
                                    variant={item.primary ? 'default' : 'outline'}
                                    className='w-full'
                                    disabled={isRepoBusy || loadingAction !== null}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void Promise.resolve(item.action());
                                    }}>
                                    {isRepoLoading && loadingAction === (item.primary ? 'open' : 'clone') ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : (
                                        <Plus className='mr-2 h-4 w-4' />
                                    )}
                                    {item.title}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Features */}
                <div className='space-y-4'>
                    <h2 className='text-center text-xl font-semibold'>Features</h2>
                    <div className='grid gap-4 md:grid-cols-3'>
                        {features.map((feature, index) => (
                            <div key={index} className='ui-surface flex items-start gap-3 rounded-lg border p-4'>
                                <div className='bg-muted shrink-0 rounded-lg p-2'>{feature.icon}</div>
                                <div>
                                    <h3 className='text-sm font-medium'>{feature.title}</h3>
                                    <p className='text-muted-foreground mt-1 text-xs'>{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Keyboard shortcut hint */}
                <div className='text-muted-foreground text-center text-sm'>
                    <p>
                        Press <kbd className='ui-kbd'>?</kbd> for keyboard shortcuts or <kbd className='ui-kbd'>⌘K</kbd>{' '}
                        to open the fuzzy finder
                    </p>
                </div>
            </div>
        </div>
    );
}

export default WelcomeScreen;
