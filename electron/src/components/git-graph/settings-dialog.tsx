/**
 * Settings/Preferences Dialog
 * Comprehensive app configuration
 */

import {
    Settings,
    Globe,
    Palette,
    Bell,
    Shield,
    HardDrive,
    GitBranch,
    Check,
    Loader2,
    RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useSettings } from './useSettings';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { trpc } from '@/trpc/client';

import type { SettingsSection } from './use-git-graph-shell-panels';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialTab?: 'general' | 'appearance' | 'editor' | 'notifications' | 'performance' | 'integrations' | 'privacy';
    initialSection?: SettingsSection | null;
}

interface FeatureFlagsState {
    worktreePro: boolean;
    workflowEngine: boolean;
    graphiteInterop: boolean;
    aiProd: boolean;
    deepLinks: boolean;
    branchPinning: boolean;
}

interface AIConfigState {
    enabled: boolean;
    provider: 'openai-compatible' | 'self-host';
    baseUrl: string;
    model: string;
    timeoutMs: number;
    maxTokens: number;
    retries: number;
    redactSensitivePaths: boolean;
    featureToggles: {
        commitMessage: boolean;
        pullRequest: boolean;
        conflictExplain: boolean;
        explainCommit: boolean;
        reviewDiff: boolean;
    };
}

interface RepoPolicyState {
    requireSignedCommits: boolean;
    allowedMergeStrategies: Array<'merge' | 'rebase' | 'squash'>;
    requireUpToDate: boolean;
    enableStacking: boolean;
    defaultStackBase: string;
    customWorkflow: string;
}

const DEFAULT_FEATURE_FLAGS: FeatureFlagsState = {
    worktreePro: true,
    workflowEngine: true,
    graphiteInterop: false,
    aiProd: false,
    deepLinks: true,
    branchPinning: true,
};

const DEFAULT_AI_CONFIG: AIConfigState = {
    enabled: false,
    provider: 'openai-compatible',
    baseUrl: '',
    model: 'gpt-4o-mini',
    timeoutMs: 20_000,
    maxTokens: 600,
    retries: 1,
    redactSensitivePaths: true,
    featureToggles: {
        commitMessage: true,
        pullRequest: true,
        conflictExplain: true,
        explainCommit: true,
        reviewDiff: true,
    },
};

const DEFAULT_REPO_POLICY: RepoPolicyState = {
    requireSignedCommits: false,
    allowedMergeStrategies: ['merge', 'rebase', 'squash'],
    requireUpToDate: false,
    enableStacking: false,
    defaultStackBase: 'main',
    customWorkflow: '',
};

export function SettingsDialog({
    open,
    onOpenChange,
    initialTab = 'general',
    initialSection = null,
}: SettingsDialogProps) {
    const { activeRepo } = useAppStore();
    const { settings, updateSetting, resetSettings } = useSettings();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [activeSection, setActiveSection] = useState<SettingsSection | null>(initialSection);
    const sectionRefs = useRef<Partial<Record<SettingsSection, HTMLDivElement | null>>>({});
    const utils = trpc.useUtils();
    const configQuery = trpc.config.getAll.useQuery(undefined, { enabled: open, staleTime: 10_000 });
    const aiConfigQuery = trpc.ai.getConfig.useQuery(undefined, { enabled: open, staleTime: 10_000 });
    const diagnosticsQuery = trpc.system.diagnostics.useQuery(undefined, { enabled: open, staleTime: 10_000 });
    const auditLogQuery = trpc.system.audit.list.useQuery(
        { repo: activeRepo ?? null, limit: 20 },
        { enabled: open, staleTime: 5_000 }
    );
    const repoPolicyQuery = trpc.repo.policy.get.useQuery(
        { repo: activeRepo ?? '' },
        { enabled: open && !!activeRepo, staleTime: 10_000 }
    );
    const saveFeatureFlagsMutation = trpc.config.setUi.useMutation({
        onSuccess: () => {
            toast.success('Feature flags saved');
            void Promise.allSettled([utils.config.getAll.invalidate()]);
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        },
    });
    const saveAIConfigMutation = trpc.ai.setConfig.useMutation({
        onSuccess: () => {
            toast.success('AI provider settings saved');
            void Promise.allSettled([utils.ai.getConfig.invalidate()]);
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        },
    });
    const saveRuntimeApiKeyMutation = trpc.ai.setRuntimeApiKey.useMutation({
        onSuccess: () => {
            setRuntimeApiKey('');
            toast.success('Runtime API key updated');
            void Promise.allSettled([utils.ai.getConfig.invalidate()]);
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        },
    });
    const auditLogMutation = trpc.system.audit.log.useMutation();
    const saveRepoPolicyMutation = trpc.repo.policy.set.useMutation({
        onSuccess: () => {
            toast.success('Repo policy saved');
            auditLogMutation.mutate({
                scope: 'policy',
                action: 'repo-policy-save',
                repo: activeRepo ?? null,
                status: 'success',
                summary: `Updated repo policy for ${activeRepo ?? 'repository'}`,
            });
            void repoPolicyQuery.refetch();
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Unknown error');
        },
    });
    const [featureFlags, setFeatureFlags] = useState<FeatureFlagsState>(DEFAULT_FEATURE_FLAGS);
    const [aiConfig, setAiConfig] = useState<AIConfigState>(DEFAULT_AI_CONFIG);
    const [repoPolicy, setRepoPolicy] = useState<RepoPolicyState>(DEFAULT_REPO_POLICY);
    const [runtimeApiKey, setRuntimeApiKey] = useState('');

    useEffect(() => {
        if (open) {
            setActiveTab(initialTab);
            setActiveSection(initialSection);
        }
    }, [initialSection, initialTab, open]);

    useEffect(() => {
        if (!open || activeTab !== 'integrations' || !activeSection) {
            return;
        }

        const timer = window.setTimeout(() => {
            sectionRefs.current[activeSection]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 30);

        return () => { window.clearTimeout(timer); };
    }, [activeSection, activeTab, open]);

    const integrationsSections = useMemo(
        () => [
            { id: 'feature-flags' as const, label: 'Feature Flags' },
            { id: 'ai-provider' as const, label: 'AI Provider' },
            { id: 'repo-policy' as const, label: 'Repo Policy' },
            { id: 'diagnostics' as const, label: 'Diagnostics' },
            { id: 'audit-log' as const, label: 'Audit Log' },
        ],
        []
    );

    useEffect(() => {
        const ui = configQuery.data?.ui;
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!ui || !('featureFlags' in ui) || typeof ui.featureFlags !== 'object' || ui.featureFlags === null) {
            return;
        }
        const flags = ui.featureFlags as Partial<FeatureFlagsState>;
        setFeatureFlags({
            ...DEFAULT_FEATURE_FLAGS,
            ...flags,
        });
    }, [configQuery.data?.ui]);

    useEffect(() => {
        const config = aiConfigQuery.data;
        if (!config) {
            return;
        }
        setAiConfig({
            enabled: config.enabled,
            provider: config.provider === 'self-host' ? 'self-host' : 'openai-compatible',
            baseUrl: config.baseUrl,
            model: config.model,
            timeoutMs: Number.isFinite(config.timeoutMs) ? config.timeoutMs : DEFAULT_AI_CONFIG.timeoutMs,
            maxTokens: Number.isFinite(config.maxTokens) ? config.maxTokens : DEFAULT_AI_CONFIG.maxTokens,
            retries: Number.isFinite(config.retries) ? config.retries : DEFAULT_AI_CONFIG.retries,
            redactSensitivePaths: config.redactSensitivePaths,
            featureToggles: {
                commitMessage: config.featureToggles.commitMessage,
                pullRequest: config.featureToggles.pullRequest,
                conflictExplain: config.featureToggles.conflictExplain,
                explainCommit: config.featureToggles.explainCommit,
                reviewDiff: config.featureToggles.reviewDiff,
            },
        });
    }, [aiConfigQuery.data]);

    useEffect(() => {
        const policy = repoPolicyQuery.data?.policy;
        if (!policy) {
            setRepoPolicy(DEFAULT_REPO_POLICY);
            return;
        }
        setRepoPolicy({
            requireSignedCommits: policy.requireSignedCommits,
            allowedMergeStrategies: Array.isArray(policy.allowedMergeStrategies) && policy.allowedMergeStrategies.length > 0
                ? policy.allowedMergeStrategies
                : DEFAULT_REPO_POLICY.allowedMergeStrategies,
            requireUpToDate: policy.requireUpToDate,
            enableStacking: policy.enableStacking,
            defaultStackBase: policy.defaultStackBase || 'main',
            customWorkflow: policy.customWorkflow || '',
        });
    }, [repoPolicyQuery.data?.policy]);

    const handleSaveFeatureFlags = () => {
        saveFeatureFlagsMutation.mutate({
            featureFlags,
        });
    };

    const handleSaveAiConfig = () => {
        saveAIConfigMutation.mutate({
            ...aiConfig,
            timeoutMs: Math.max(2_000, Math.min(120_000, Math.round(aiConfig.timeoutMs))),
            maxTokens: Math.max(32, Math.min(4_096, Math.round(aiConfig.maxTokens))),
            retries: Math.max(0, Math.min(5, Math.round(aiConfig.retries))),
        });
    };

    const handleSetRuntimeApiKey = () => {
        if (!runtimeApiKey.trim()) {
            toast.error('Enter a runtime API key first');
            return;
        }
        saveRuntimeApiKeyMutation.mutate({ apiKey: runtimeApiKey.trim() });
    };

    const handleSaveRepoPolicy = () => {
        if (!activeRepo) {
            toast.error('No active repository');
            return;
        }
        saveRepoPolicyMutation.mutate({
            repo: activeRepo,
            policy: repoPolicy,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='ui-surface flex max-h-[90vh] max-w-3xl flex-col'>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <Settings className='h-5 w-5' />
                        Settings
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className='flex flex-1 flex-col'>
                    <TabsList className='grid w-full grid-cols-7'>
                        <TabsTrigger value='general'>General</TabsTrigger>
                        <TabsTrigger value='appearance'>Appearance</TabsTrigger>
                        <TabsTrigger value='editor'>Editor</TabsTrigger>
                        <TabsTrigger value='notifications'>Notify</TabsTrigger>
                        <TabsTrigger value='performance'>Performance</TabsTrigger>
                        <TabsTrigger value='integrations'>Integrations</TabsTrigger>
                        <TabsTrigger value='privacy'>Privacy</TabsTrigger>
                    </TabsList>

                    <ScrollArea className='mt-4 flex-1'>
                        <TabsContent value='general' className='m-0 space-y-6'>
                            <SettingsSection title='General' icon={<Settings className='h-4 w-4' />}>
                                <SettingRow
                                    label='Confirm destructive actions'
                                    description='Ask for confirmation before destructive operations'>
                                    <Switch
                                        checked={settings.confirmDestructiveActions}
                                        onCheckedChange={(v: boolean) => { updateSetting('confirmDestructiveActions', v); }}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Auto-fetch interval'
                                    description='Automatically fetch from remotes (minutes, 0 to disable)'>
                                    <Input
                                        type='number'
                                        min={0}
                                        max={60}
                                        className='w-20'
                                        value={settings.autoFetchInterval}
                                        onChange={(e) =>
                                            { updateSetting('autoFetchInterval', parseInt(e.currentTarget.value) || 0); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label='Check for updates' description='Automatically check for app updates'>
                                    <Switch
                                        checked={settings.checkForUpdates}
                                        onCheckedChange={(v: boolean) => { updateSetting('checkForUpdates', v); }}
                                    />
                                </SettingRow>
                                <SettingRow label='Launch at startup' description='Start Git Graph when you log in'>
                                    <Switch
                                        checked={settings.launchAtStartup}
                                        onCheckedChange={(v: boolean) => { updateSetting('launchAtStartup', v); }}
                                    />
                                </SettingRow>
                                <SettingRow label='Lens Mode' description='Choose your interface experience level'>
                                    <select
                                        className='h-9 rounded-md border bg-transparent px-3 py-1 text-sm'
                                        value={settings.lensMode}
                                        onChange={(e) =>
                                            { updateSetting('lensMode', e.currentTarget.value as 'guided' | 'craft' | 'control'); }
                                        }>
                                        <option value='guided'>Guided - Simple and safe</option>
                                        <option value='craft'>Craft - Balanced with shortcuts</option>
                                        <option value='control'>Control - Full power</option>
                                    </select>
                                </SettingRow>
                            </SettingsSection>
                        </TabsContent>

                        <TabsContent value='appearance' className='m-0 space-y-6'>
                            <SettingsSection title='Theme' icon={<Palette className='h-4 w-4' />}>
                                <SettingRow label='Color theme' description='Choose light, dark, or follow system'>
                                    <select
                                        className='h-9 rounded-md border bg-transparent px-3 py-1 text-sm'
                                        value={settings.theme}
                                        onChange={(e) =>
                                            { updateSetting('theme', e.currentTarget.value as typeof settings.theme); }
                                        }>
                                        <option value='system'>System</option>
                                        <option value='light'>Light</option>
                                        <option value='dark'>Dark</option>
                                    </select>
                                </SettingRow>
                                <SettingRow label='Graph theme' description='Visual style for commit graph'>
                                    <select
                                        className='h-9 rounded-md border bg-transparent px-3 py-1 text-sm'
                                        value={settings.graphTheme}
                                        onChange={(e) =>
                                            { updateSetting('graphTheme', e.currentTarget.value as typeof settings.graphTheme); }
                                        }>
                                        <option value='default'>Default</option>
                                        <option value='colorful'>Colorful</option>
                                        <option value='minimal'>Minimal</option>
                                    </select>
                                </SettingRow>
                            </SettingsSection>

                            <SettingsSection title='Display' icon={<Globe className='h-4 w-4' />}>
                                <SettingRow label='Show avatars' description='Display author avatars in commits'>
                                    <Switch
                                        checked={settings.showAvatars}
                                        onCheckedChange={(v: boolean) => { updateSetting('showAvatars', v); }}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Show relative dates'
                                    description="Use '2 days ago' instead of full dates">
                                    <Switch
                                        checked={settings.showRelativeDates}
                                        onCheckedChange={(v: boolean) => { updateSetting('showRelativeDates', v); }}
                                    />
                                </SettingRow>
                                <SettingRow label='Date format' description='How to display dates'>
                                    <select
                                        className='h-9 rounded-md border bg-transparent px-3 py-1 text-sm'
                                        value={settings.dateFormat}
                                        onChange={(e) =>
                                            { updateSetting('dateFormat', e.currentTarget.value as typeof settings.dateFormat); }
                                        }>
                                        <option value='relative'>Relative</option>
                                        <option value='iso'>ISO (YYYY-MM-DD)</option>
                                        <option value='locale'>Locale</option>
                                    </select>
                                </SettingRow>
                                <SettingRow
                                    label='High-contrast mode'
                                    description='Increase contrast and focus visibility for accessibility'>
                                    <Switch
                                        checked={settings.enhancedAccessibility}
                                        onCheckedChange={(v: boolean) => { updateSetting('enhancedAccessibility', v); }}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Commit message length'
                                    description='Max characters before truncating (0 = no limit)'>
                                    <Input
                                        type='number'
                                        min={0}
                                        max={200}
                                        className='w-20'
                                        value={settings.commitMessageLength}
                                        onChange={(e) =>
                                            { updateSetting('commitMessageLength', parseInt(e.currentTarget.value) || 0); }
                                        }
                                    />
                                </SettingRow>
                            </SettingsSection>
                        </TabsContent>

                        <TabsContent value='editor' className='m-0 space-y-6'>
                            <SettingsSection title='Commit' icon={<GitBranch className='h-4 w-4' />}>
                                <SettingRow
                                    label='Default branch name'
                                    description="Name for new repositories' default branch">
                                    <Input
                                        className='w-32'
                                        value={settings.defaultBranch}
                                        onChange={(e) => { updateSetting('defaultBranch', e.currentTarget.value); }}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Auto-sign commits'
                                    description='Automatically sign commits with GPG/SSH key'>
                                    <Switch
                                        checked={settings.autoSignCommits}
                                        onCheckedChange={(v: boolean) => { updateSetting('autoSignCommits', v); }}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Commit template'
                                    description='Default template for new commit messages'>
                                    <textarea
                                        className='h-20 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm'
                                        placeholder='feat: &#10;&#10;'
                                        value={settings.commitTemplate}
                                        onChange={(e) => { updateSetting('commitTemplate', e.currentTarget.value); }}
                                    />
                                </SettingRow>
                            </SettingsSection>

                            <SettingsSection title='External Tools' icon={<HardDrive className='h-4 w-4' />}>
                                <SettingRow
                                    label='Merge tool'
                                    description='External tool for resolving merge conflicts'>
                                    <Input
                                        className='w-48'
                                        placeholder='e.g., code --wait'
                                        value={settings.mergeTool}
                                        onChange={(e) => { updateSetting('mergeTool', e.currentTarget.value); }}
                                    />
                                </SettingRow>
                            </SettingsSection>
                        </TabsContent>

                        <TabsContent value='notifications' className='m-0 space-y-6'>
                            <SettingsSection title='Notifications' icon={<Bell className='h-4 w-4' />}>
                                <SettingRow label='Push notifications' description='Notify when push completes'>
                                    <Switch
                                        checked={settings.notifyOnPush}
                                        onCheckedChange={(v: boolean) => { updateSetting('notifyOnPush', v); }}
                                    />
                                </SettingRow>
                                <SettingRow label='Pull notifications' description='Notify when pull completes'>
                                    <Switch
                                        checked={settings.notifyOnPull}
                                        onCheckedChange={(v: boolean) => { updateSetting('notifyOnPull', v); }}
                                    />
                                </SettingRow>
                                <SettingRow label='Merge notifications' description='Notify when merge completes'>
                                    <Switch
                                        checked={settings.notifyOnMerge}
                                        onCheckedChange={(v: boolean) => { updateSetting('notifyOnMerge', v); }}
                                    />
                                </SettingRow>
                                <SettingRow label='Sound effects' description='Play sounds for notifications'>
                                    <Switch
                                        checked={settings.soundEnabled}
                                        onCheckedChange={(v: boolean) => { updateSetting('soundEnabled', v); }}
                                    />
                                </SettingRow>
                            </SettingsSection>
                        </TabsContent>

                        <TabsContent value='performance' className='m-0 space-y-6'>
                            <SettingsSection title='Performance' icon={<HardDrive className='h-4 w-4' />}>
                                <SettingRow
                                    label='Max commits to load'
                                    description='Limit commits loaded for large repos'>
                                    <Input
                                        type='number'
                                        min={100}
                                        max={10000}
                                        step={100}
                                        className='w-24'
                                        value={settings.maxCommits}
                                        onChange={(e) => { updateSetting('maxCommits', parseInt(e.currentTarget.value) || 1000); }}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Enable virtualization'
                                    description='Use virtual scrolling for better performance'>
                                    <Switch
                                        checked={settings.enableVirtualization}
                                        onCheckedChange={(v: boolean) => { updateSetting('enableVirtualization', v); }}
                                    />
                                </SettingRow>
                                <SettingRow label='Lazy load images' description='Defer loading images until needed'>
                                    <Switch
                                        checked={settings.lazyLoadImages}
                                        onCheckedChange={(v: boolean) => { updateSetting('lazyLoadImages', v); }}
                                    />
                                </SettingRow>
                            </SettingsSection>
                        </TabsContent>

                        <TabsContent value='integrations' className='m-0 space-y-6'>
                            <div className='flex flex-wrap gap-2'>
                                {integrationsSections.map((section) => (
                                    <Button
                                        key={section.id}
                                        type='button'
                                        size='sm'
                                        variant={activeSection === section.id ? 'default' : 'outline'}
                                        className='h-8'
                                        onClick={() => {
                                            setActiveSection(section.id);
                                            sectionRefs.current[section.id]?.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'start',
                                            });
                                        }}>
                                        {section.label}
                                    </Button>
                                ))}
                            </div>

                            <SettingsSection
                                title='Release Feature Flags'
                                icon={<GitBranch className='h-4 w-4' />}
                                sectionId='feature-flags'
                                activeSection={activeSection}
                                onSectionRef={(node) => {
                                    sectionRefs.current['feature-flags'] = node;
                                }}>
                                <SettingRow
                                    label='Worktree Pro'
                                    description='Unified worktree center and advanced lifecycle actions'>
                                    <Switch
                                        checked={featureFlags.worktreePro}
                                        onCheckedChange={(value: boolean) =>
                                            { setFeatureFlags((previous) => ({ ...previous, worktreePro: value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Workflow Engine'
                                    description='Tower-style workflow templates and execution runs'>
                                    <Switch
                                        checked={featureFlags.workflowEngine}
                                        onCheckedChange={(value: boolean) =>
                                            { setFeatureFlags((previous) => ({ ...previous, workflowEngine: value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Graphite Interop'
                                    description='Stack sync, restack, and Graphite CLI interoperability'>
                                    <Switch
                                        checked={featureFlags.graphiteInterop}
                                        onCheckedChange={(value: boolean) =>
                                            { setFeatureFlags((previous) => ({ ...previous, graphiteInterop: value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='AI Production Features'
                                    description='Provider-backed commit/PR/conflict/commit-explain assistance'>
                                    <Switch
                                        checked={featureFlags.aiProd}
                                        onCheckedChange={(value: boolean) =>
                                            { setFeatureFlags((previous) => ({ ...previous, aiProd: value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Deep Links'
                                    description='App protocol links for repo/branch/commit context'>
                                    <Switch
                                        checked={featureFlags.deepLinks}
                                        onCheckedChange={(value: boolean) =>
                                            { setFeatureFlags((previous) => ({ ...previous, deepLinks: value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Branch Pinning'
                                    description='Pinned branches and smart branch ranking filters'>
                                    <Switch
                                        checked={featureFlags.branchPinning}
                                        onCheckedChange={(value: boolean) =>
                                            { setFeatureFlags((previous) => ({ ...previous, branchPinning: value })); }
                                        }
                                    />
                                </SettingRow>
                                <div className='flex justify-end pt-2'>
                                    <Button onClick={handleSaveFeatureFlags} disabled={saveFeatureFlagsMutation.isPending}>
                                        {saveFeatureFlagsMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                                        Save Feature Flags
                                    </Button>
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                title='AI Provider'
                                icon={<Globe className='h-4 w-4' />}
                                sectionId='ai-provider'
                                activeSection={activeSection}
                                onSectionRef={(node) => {
                                    sectionRefs.current['ai-provider'] = node;
                                }}>
                                <SettingRow
                                    label='Enable AI'
                                    description='Master switch for provider-backed AI assistance'>
                                    <Switch
                                        checked={aiConfig.enabled}
                                        onCheckedChange={(value: boolean) =>
                                            { setAiConfig((previous) => ({ ...previous, enabled: value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Provider Mode'
                                    description='OpenAI-compatible cloud endpoint or self-hosted compatible endpoint'>
                                    <select
                                        className='h-9 rounded-md border bg-transparent px-3 py-1 text-sm'
                                        value={aiConfig.provider}
                                        onChange={(event) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                provider: event.currentTarget.value === 'self-host' ? 'self-host' : 'openai-compatible',
                                            })); }
                                        }>
                                        <option value='openai-compatible'>OpenAI-compatible</option>
                                        <option value='self-host'>Self-host compatible</option>
                                    </select>
                                </SettingRow>
                                <SettingRow
                                    label='Base URL'
                                    description='Provider base URL. Example: https://api.openai.com'>
                                    <Input
                                        className='w-64'
                                        placeholder='https://api.openai.com'
                                        value={aiConfig.baseUrl}
                                        onChange={(event) =>
                                            { setAiConfig((previous) => ({ ...previous, baseUrl: event.currentTarget.value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label='Model' description='Model identifier used for all AI features'>
                                    <Input
                                        className='w-48'
                                        value={aiConfig.model}
                                        onChange={(event) =>
                                            { setAiConfig((previous) => ({ ...previous, model: event.currentTarget.value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Timeout (ms)'
                                    description='Request timeout bound for provider calls'>
                                    <Input
                                        type='number'
                                        min={2000}
                                        max={120000}
                                        className='w-28'
                                        value={aiConfig.timeoutMs}
                                        onChange={(event) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                timeoutMs: Number.parseInt(event.currentTarget.value, 10) || previous.timeoutMs,
                                            })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Max Tokens'
                                    description='Upper bound tokens per AI response'>
                                    <Input
                                        type='number'
                                        min={32}
                                        max={4096}
                                        className='w-28'
                                        value={aiConfig.maxTokens}
                                        onChange={(event) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                maxTokens: Number.parseInt(event.currentTarget.value, 10) || previous.maxTokens,
                                            })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label='Retries' description='Automatic retry attempts after transient failures'>
                                    <Input
                                        type='number'
                                        min={0}
                                        max={5}
                                        className='w-20'
                                        value={aiConfig.retries}
                                        onChange={(event) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                retries: Number.parseInt(event.currentTarget.value, 10) || 0,
                                            })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Redact Sensitive Paths'
                                    description='Redact local usernames and home paths before provider calls'>
                                    <Switch
                                        checked={aiConfig.redactSensitivePaths}
                                        onCheckedChange={(value: boolean) =>
                                            { setAiConfig((previous) => ({ ...previous, redactSensitivePaths: value })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Commit Message Generation'
                                    description='Generate commit messages from staged diffs'>
                                    <Switch
                                        checked={aiConfig.featureToggles.commitMessage}
                                        onCheckedChange={(value: boolean) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    commitMessage: value,
                                                },
                                            })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Pull Request Generation'
                                    description='Generate PR title/body from branch delta'>
                                    <Switch
                                        checked={aiConfig.featureToggles.pullRequest}
                                        onCheckedChange={(value: boolean) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    pullRequest: value,
                                                },
                                            })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Conflict Explanation'
                                    description='Explain conflicts and suggest resolution paths'>
                                    <Switch
                                        checked={aiConfig.featureToggles.conflictExplain}
                                        onCheckedChange={(value: boolean) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    conflictExplain: value,
                                                },
                                            })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Explain Commit'
                                    description='Summarize commit intent and potential risk areas'>
                                    <Switch
                                        checked={aiConfig.featureToggles.explainCommit}
                                        onCheckedChange={(value: boolean) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    explainCommit: value,
                                                },
                                            })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Review Diff'
                                    description='Generate review notes, risks, and test focus from a commit or diff'>
                                    <Switch
                                        checked={aiConfig.featureToggles.reviewDiff}
                                        onCheckedChange={(value: boolean) =>
                                            { setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    reviewDiff: value,
                                                },
                                            })); }
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Runtime API Key'
                                    description='Session-scoped key. Stored in memory, never persisted in renderer storage.'>
                                    <div className='flex items-center gap-2'>
                                        <Input
                                            type='password'
                                            className='w-56'
                                            placeholder='sk-...'
                                            value={runtimeApiKey}
                                            onChange={(event) => { setRuntimeApiKey(event.currentTarget.value); }}
                                        />
                                        <Button
                                            variant='outline'
                                            onClick={handleSetRuntimeApiKey}
                                            disabled={saveRuntimeApiKeyMutation.isPending}>
                                            {saveRuntimeApiKeyMutation.isPending && (
                                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                            )}
                                            Set Key
                                        </Button>
                                    </div>
                                </SettingRow>
                                <div className='text-muted-foreground flex items-center justify-between text-xs'>
                                    <span>
                                        Runtime key status:{' '}
                                        {aiConfigQuery.data?.hasRuntimeKey ? (
                                            <span className='text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]'>Configured</span>
                                        ) : (
                                            <span>Not configured</span>
                                        )}
                                    </span>
                                    {aiConfigQuery.data?.hasRuntimeKey && <Check className='h-3.5 w-3.5 text-[color-mix(in_oklch,var(--success)_72%,var(--foreground))]' />}
                                </div>
                                <div className='flex justify-end pt-2'>
                                    <Button onClick={handleSaveAiConfig} disabled={saveAIConfigMutation.isPending}>
                                        {saveAIConfigMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                                        Save AI Settings
                                    </Button>
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                title='Repo Policy'
                                icon={<Shield className='h-4 w-4' />}
                                sectionId='repo-policy'
                                activeSection={activeSection}
                                onSectionRef={(node) => {
                                    sectionRefs.current['repo-policy'] = node;
                                }}>
                                {!activeRepo ? (
                                    <p className='text-muted-foreground text-sm'>Open a repository to configure repo-specific policy guidance.</p>
                                ) : (
                                    <>
                                        <SettingRow
                                            label='Require signed commits'
                                            description='Surface policy guidance when commit signing is expected for this repository'>
                                            <Switch
                                                checked={repoPolicy.requireSignedCommits}
                                                onCheckedChange={(value: boolean) =>
                                                    { setRepoPolicy((previous) => ({ ...previous, requireSignedCommits: value })); }
                                                }
                                            />
                                        </SettingRow>
                                        <SettingRow
                                            label='Require up-to-date branch'
                                            description='Guide merges and reviews toward rebasing or updating before integration'>
                                            <Switch
                                                checked={repoPolicy.requireUpToDate}
                                                onCheckedChange={(value: boolean) =>
                                                    { setRepoPolicy((previous) => ({ ...previous, requireUpToDate: value })); }
                                                }
                                            />
                                        </SettingRow>
                                        <SettingRow
                                            label='Enable stacking guidance'
                                            description='Mark this repository as stack-friendly for stacked branch workflows'>
                                            <Switch
                                                checked={repoPolicy.enableStacking}
                                                onCheckedChange={(value: boolean) =>
                                                    { setRepoPolicy((previous) => ({ ...previous, enableStacking: value })); }
                                                }
                                            />
                                        </SettingRow>
                                        <SettingRow
                                            label='Default stack base'
                                            description='Base branch used for stack-aware workflows and review guidance'>
                                            <Input
                                                className='w-32'
                                                value={repoPolicy.defaultStackBase}
                                                onChange={(event) =>
                                                    { setRepoPolicy((previous) => ({ ...previous, defaultStackBase: event.currentTarget.value })); }
                                                }
                                            />
                                        </SettingRow>
                                        <SettingRow
                                            label='Allowed merge strategies'
                                            description='Restrict preferred integration strategies for pull requests'>
                                            <div className='flex gap-4 text-sm'>
                                                {(['merge', 'rebase', 'squash'] as const).map((strategy) => {
                                                    const checked = repoPolicy.allowedMergeStrategies.includes(strategy);
                                                    return (
                                                        <label key={strategy} className='flex items-center gap-2'>
                                                            <input
                                                                type='checkbox'
                                                                checked={checked}
                                                                onChange={(event) => {
                                                                    setRepoPolicy((previous) => {
                                                                        const next = event.currentTarget.checked
                                                                            ? [...previous.allowedMergeStrategies, strategy]
                                                                            : previous.allowedMergeStrategies.filter((entry) => entry !== strategy);
                                                                        return {
                                                                            ...previous,
                                                                            allowedMergeStrategies: next.length > 0 ? next : previous.allowedMergeStrategies,
                                                                        };
                                                                    });
                                                                }}
                                                            />
                                                            <span className='capitalize'>{strategy}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </SettingRow>
                                        <SettingRow
                                            label='Workflow guidance'
                                            description='Freeform policy note shown to operators and reviewers'>
                                            <Input
                                                className='w-80'
                                                placeholder='Example: Rebase stacks onto main before merge.'
                                                value={repoPolicy.customWorkflow}
                                                onChange={(event) =>
                                                    { setRepoPolicy((previous) => ({ ...previous, customWorkflow: event.currentTarget.value })); }
                                                }
                                            />
                                        </SettingRow>
                                        <div className='flex justify-end pt-2'>
                                            <Button onClick={handleSaveRepoPolicy} disabled={saveRepoPolicyMutation.isPending}>
                                                {saveRepoPolicyMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                                                Save Repo Policy
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </SettingsSection>

                            <SettingsSection
                                title='Diagnostics'
                                icon={<HardDrive className='h-4 w-4' />}
                                sectionId='diagnostics'
                                activeSection={activeSection}
                                onSectionRef={(node) => {
                                    sectionRefs.current['diagnostics'] = node;
                                }}>
                                <SettingRow
                                    label='Protocol registration'
                                    description='Desktop deep links require the app to own the `gitgraph://` protocol'>
                                    <span className='text-sm'>
                                        {diagnosticsQuery.data?.protocolRegistered ? 'Registered' : 'Not registered'}
                                    </span>
                                </SettingRow>
                                <SettingRow
                                    label='App version'
                                    description='Current packaged or development build identity'>
                                    <span className='text-sm'>
                                        {diagnosticsQuery.data?.appVersion ?? 'Unknown'} ({diagnosticsQuery.data?.platform ?? 'unknown'}/{diagnosticsQuery.data?.arch ?? 'unknown'})
                                    </span>
                                </SettingRow>
                                <SettingRow
                                    label='Packaging mode'
                                    description='Use this to confirm protocol/update behavior in dev versus packaged builds'>
                                    <span className='text-sm'>
                                        {diagnosticsQuery.data?.isPackaged ? 'Packaged build' : 'Development build'}
                                    </span>
                                </SettingRow>
                                <SettingRow
                                    label='CLI helper'
                                    description='Installed wrapper path used for `gg open`, `gg diff`, and related entrypoints'>
                                    <span className='max-w-[320px] truncate text-sm'>{diagnosticsQuery.data?.ggScriptPath ?? 'Unavailable'}</span>
                                </SettingRow>
                            </SettingsSection>

                            <SettingsSection
                                title='Audit Log'
                                icon={<Bell className='h-4 w-4' />}
                                sectionId='audit-log'
                                activeSection={activeSection}
                                onSectionRef={(node) => {
                                    sectionRefs.current['audit-log'] = node;
                                }}>
                                <div className='space-y-2'>
                                    {(auditLogQuery.data?.entries ?? []).map(
                                        (entry: {
                                            id: string;
                                            summary: string;
                                            timestamp: number;
                                            scope: string;
                                            status: string;
                                            repo?: string | null;
                                            details?: string | null;
                                        }) => (
                                        <div key={entry.id} className='rounded-lg border px-3 py-2'>
                                            <div className='flex items-center justify-between gap-3'>
                                                <p className='text-sm font-medium'>{entry.summary}</p>
                                                <span className='text-muted-foreground text-xs'>
                                                    {new Date(entry.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className='text-muted-foreground mt-1 text-xs'>
                                                {entry.scope} · {entry.status}{entry.repo ? ` · ${entry.repo}` : ''}
                                            </p>
                                            {entry.details && (
                                                <p className='text-muted-foreground mt-1 text-xs'>{entry.details}</p>
                                            )}
                                        </div>
                                        )
                                    )}
                                    {(auditLogQuery.data?.entries ?? []).length === 0 && (
                                        <p className='text-muted-foreground text-sm'>No audit entries yet for this scope.</p>
                                    )}
                                </div>
                            </SettingsSection>
                        </TabsContent>

                        <TabsContent value='privacy' className='m-0 space-y-6'>
                            <SettingsSection title='Privacy' icon={<Shield className='h-4 w-4' />}>
                                <SettingRow
                                    label='Usage telemetry'
                                    description='Send anonymous usage data to help improve the app'>
                                    <Switch
                                        checked={settings.telemetryEnabled}
                                        onCheckedChange={(v: boolean) => { updateSetting('telemetryEnabled', v); }}
                                    />
                                </SettingRow>
                                <SettingRow label='Crash reports' description='Automatically send crash reports'>
                                    <Switch
                                        checked={settings.crashReports}
                                        onCheckedChange={(v: boolean) => { updateSetting('crashReports', v); }}
                                    />
                                </SettingRow>
                            </SettingsSection>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                <div className='ui-toolbar -mx-4 -mb-4 px-4 py-3'>
                    <Button variant='outline' onClick={resetSettings}>
                        <RotateCcw className='mr-2 h-4 w-4' />
                        Reset to Defaults
                    </Button>
                    <Button onClick={() => { onOpenChange(false); }}>Done</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SettingsSection({
    title,
    icon,
    children,
    sectionId,
    activeSection,
    onSectionRef,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    sectionId?: SettingsSection;
    activeSection?: SettingsSection | null;
    onSectionRef?: (node: HTMLDivElement | null) => void;
}) {
    const isActive = Boolean(sectionId && activeSection === sectionId);

    return (
        <div
            ref={onSectionRef}
            className={`space-y-4 scroll-mt-4 rounded-xl px-1 py-1 transition-colors ${
                isActive ? 'bg-primary/5 ring-1 ring-primary/15' : ''
            }`}>
            <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
                {icon}
                {title}
            </div>
            <div className='space-y-3 pl-6'>{children}</div>
        </div>
    );
}

function SettingRow({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className='flex items-center justify-between py-2'>
            <div className='flex-1 pr-4'>
                <div className='text-sm font-medium'>{label}</div>
                {description && <div className='text-muted-foreground text-xs'>{description}</div>}
            </div>
            <div className='shrink-0'>{children}</div>
        </div>
    );
}

export default SettingsDialog;
