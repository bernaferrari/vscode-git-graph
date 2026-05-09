/**
 * Lens Mode Onboarding
 * Explains the lens system to new users
 */

import { Compass, Wand2, Terminal, ArrowRight, Check, Sparkles, Keyboard, Shield, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useLensMode, type LensMode } from '@/components/lens';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/client';

interface LensOnboardingProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const LENS_DETAILS = [
    {
        mode: 'guided' as LensMode,
        icon: Compass,
        title: 'Guided Mode',
        subtitle: 'Safe & Simple',
        color: 'text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]',
        bgColor: 'bg-[color-mix(in_oklch,var(--success)_10%,transparent)]',
        borderColor: 'border-[color-mix(in_oklch,var(--success)_30%,transparent)]',
        features: [
            { icon: Shield, text: 'Safety first - previews show what will happen' },
            { icon: Sparkles, text: 'Simple "Sync" button for fetch + pull + push' },
            { icon: ArrowRight, text: 'Clear guidance on next best actions' },
            { icon: Check, text: 'One-click undo for any operation' },
        ],
        bestFor: 'New Git users, safe exploration, code review focus',
    },
    {
        mode: 'craft' as LensMode,
        icon: Wand2,
        title: 'Craft Mode',
        subtitle: 'Balanced Power',
        color: 'text-[color-mix(in_oklch,var(--info)_72%,var(--foreground))]',
        bgColor: 'bg-[color-mix(in_oklch,var(--info)_10%,transparent)]',
        borderColor: 'border-[color-mix(in_oklch,var(--info)_30%,transparent)]',
        features: [
            { icon: Zap, text: 'Keyboard-first workflow with shortcuts' },
            { icon: ArrowRight, text: 'Full staging granularity (hunks, lines)' },
            { icon: Keyboard, text: 'Command palette for everything' },
            { icon: Check, text: 'Advanced operations when you need them' },
        ],
        bestFor: 'Daily development, power users, efficient workflows',
    },
    {
        mode: 'control' as LensMode,
        icon: Terminal,
        title: 'Control Mode',
        subtitle: 'Full Power',
        color: 'text-[color-mix(in_oklch,var(--primary)_75%,var(--foreground))]',
        bgColor: 'bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]',
        borderColor: 'border-[color-mix(in_oklch,var(--primary)_30%,transparent)]',
        features: [
            { icon: Terminal, text: 'See raw Git commands as they run' },
            { icon: Zap, text: 'Full access to advanced Git operations' },
            { icon: Keyboard, text: 'Custom keybindings support' },
            { icon: Check, text: 'Reflog, bisect, and expert tools visible' },
        ],
        bestFor: 'Maintainers, release engineers, complex workflows',
    },
];

export function LensOnboarding({ open, onOpenChange }: LensOnboardingProps) {
    const { mode, setLensMode } = useLensMode();
    const [selectedLens, setSelectedLens] = useState<LensMode>(mode);
    const utils = trpc.useUtils();
    const setOnboardingStateMutation = trpc.config.setOnboardingState.useMutation({
        onSuccess: async () => {
            await utils.config.onboardingState.invalidate();
        },
    });

    useEffect(() => {
        if (open) {
            setSelectedLens(mode);
        }
    }, [mode, open]);

    const handleConfirm = () => {
        setLensMode(selectedLens);
        setOnboardingStateMutation.mutate({ lensOnboardingSeen: true });
        onOpenChange(false);
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setOnboardingStateMutation.mutate({ lensOnboardingSeen: true });
        }
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2 text-xl'>
                        <Sparkles className='h-5 w-5 text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))]' />
                        Choose Your Experience
                    </DialogTitle>
                    <DialogDescription className='text-base'>
                        Git Graph adapts to your skill level. Select the mode that fits you best - you can always change
                        it later.
                    </DialogDescription>
                </DialogHeader>

                <div className='grid grid-cols-1 gap-4 py-4 md:grid-cols-3'>
                    {LENS_DETAILS.map((lens) => {
                        const Icon = lens.icon;
                        const isSelected = selectedLens === lens.mode;

                        return (
                            <button
                                key={lens.mode}
                                onClick={() => { setSelectedLens(lens.mode); }}
                                className={cn(
                                    'relative flex flex-col rounded-xl border-2 p-4 text-left transition-all',
                                    lens.borderColor,
                                    lens.bgColor,
                                    isSelected ? 'ring-primary ring-2 ring-offset-2' : 'hover:opacity-80'
                                )}>
                                {isSelected && (
                                    <div className='absolute top-2 right-2'>
                                        <Check className={cn('h-5 w-5', lens.color)} />
                                    </div>
                                )}

                                <div className={cn('mb-3', lens.color)}>
                                    <Icon className='h-8 w-8' />
                                </div>

                                <h3 className='text-lg font-semibold'>{lens.title}</h3>
                                <p className={cn('mb-3 text-sm font-medium', lens.color)}>{lens.subtitle}</p>

                                <ul className='flex-1 space-y-2'>
                                    {lens.features.map((feature, i) => {
                                        const FeatureIcon = feature.icon;
                                        return (
                                            <li
                                                key={i}
                                                className='text-muted-foreground flex items-start gap-2 text-sm'>
                                                <FeatureIcon className='mt-0.5 h-4 w-4 shrink-0' />
                                                <span>{feature.text}</span>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <div className='mt-4 border-t pt-3'>
                                    <p className='text-muted-foreground text-xs'>
                                        <strong>Best for:</strong> {lens.bestFor}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className='bg-muted mt-2 rounded-lg p-4'>
                    <p className='text-muted-foreground flex items-center gap-2 text-sm'>
                        <Keyboard className='h-4 w-4' />
                        <span>
                            <strong>Quick switch:</strong> Press{' '}
                            <kbd className='bg-background rounded border px-1.5 py-0.5 text-xs'>Ctrl+1</kbd> for Guided,{' '}
                            <kbd className='bg-background rounded border px-1.5 py-0.5 text-xs'>Ctrl+2</kbd> for Craft,{' '}
                            <kbd className='bg-background rounded border px-1.5 py-0.5 text-xs'>Ctrl+3</kbd> for Control
                        </span>
                    </p>
                </div>

                <DialogFooter className='mt-4'>
                    <Button variant='outline' onClick={() => { onOpenChange(false); }}>
                        Skip for now
                    </Button>
                    <Button onClick={handleConfirm}>
                        Start with {LENS_DETAILS.find((l) => l.mode === selectedLens)?.title}
                        <ArrowRight className='ml-2 h-4 w-4' />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


// Hook to manage lens onboarding state
export function useLensOnboarding() { // eslint-disable-line react-refresh/only-export-components
    const [showOnboarding, setShowOnboarding] = useState(false);
    const onboardingQuery = trpc.config.onboardingState.useQuery(undefined, { staleTime: 10_000 });
    const shouldShow = useMemo(
        () =>
            Boolean(
                onboardingQuery.data &&
                    onboardingQuery.data.state.gitGraphCompleted &&
                    !onboardingQuery.data.state.lensOnboardingSeen
            ),
        [onboardingQuery.data]
    );

    useEffect(() => {
        setShowOnboarding(shouldShow);
    }, [shouldShow]);

    const dismissOnboarding = () => {
        setShowOnboarding(false);
    };

    return {
        showOnboarding,
        dismissOnboarding,
        LensOnboardingDialog: () => <LensOnboarding open={showOnboarding} onOpenChange={setShowOnboarding} />,
    };
}
