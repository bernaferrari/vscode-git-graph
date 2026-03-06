/**
 * Settings/Preferences Dialog
 * Comprehensive app configuration
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
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
import { trpc } from '@/trpc/client';
import { useSettings } from './useSettings';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
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
    };
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
    },
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    const { settings, updateSetting, resetSettings } = useSettings();
    const [activeTab, setActiveTab] = useState('general');
    const utils = trpc.useUtils();
    const configQuery = trpc.config.getAll.useQuery(undefined, { enabled: open, staleTime: 10_000 });
    const aiConfigQuery = trpc.ai.getConfig.useQuery(undefined, { enabled: open, staleTime: 10_000 });
    const saveFeatureFlagsMutation = trpc.config.setUi.useMutation({
        onSuccess: () => {
            toast.success('Feature flags saved');
            void Promise.allSettled([utils.config.getAll.invalidate()]);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
    const saveAIConfigMutation = trpc.ai.setConfig.useMutation({
        onSuccess: () => {
            toast.success('AI provider settings saved');
            void Promise.allSettled([utils.ai.getConfig.invalidate()]);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
    const saveRuntimeApiKeyMutation = trpc.ai.setRuntimeApiKey.useMutation({
        onSuccess: () => {
            setRuntimeApiKey('');
            toast.success('Runtime API key updated');
            void Promise.allSettled([utils.ai.getConfig.invalidate()]);
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
    const [featureFlags, setFeatureFlags] = useState<FeatureFlagsState>(DEFAULT_FEATURE_FLAGS);
    const [aiConfig, setAiConfig] = useState<AIConfigState>(DEFAULT_AI_CONFIG);
    const [runtimeApiKey, setRuntimeApiKey] = useState('');

    useEffect(() => {
        const ui = configQuery.data?.ui;
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
            enabled: Boolean(config.enabled),
            provider: config.provider === 'self-host' ? 'self-host' : 'openai-compatible',
            baseUrl: config.baseUrl ?? '',
            model: config.model ?? DEFAULT_AI_CONFIG.model,
            timeoutMs: Number.isFinite(config.timeoutMs) ? config.timeoutMs : DEFAULT_AI_CONFIG.timeoutMs,
            maxTokens: Number.isFinite(config.maxTokens) ? config.maxTokens : DEFAULT_AI_CONFIG.maxTokens,
            retries: Number.isFinite(config.retries) ? config.retries : DEFAULT_AI_CONFIG.retries,
            redactSensitivePaths: Boolean(config.redactSensitivePaths),
            featureToggles: {
                commitMessage: Boolean(config.featureToggles?.commitMessage),
                pullRequest: Boolean(config.featureToggles?.pullRequest),
                conflictExplain: Boolean(config.featureToggles?.conflictExplain),
                explainCommit: Boolean(config.featureToggles?.explainCommit),
            },
        });
    }, [aiConfigQuery.data]);

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
                                        onCheckedChange={(v) => updateSetting('confirmDestructiveActions', v)}
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
                                            updateSetting('autoFetchInterval', parseInt(e.target.value) || 0)
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label='Check for updates' description='Automatically check for app updates'>
                                    <Switch
                                        checked={settings.checkForUpdates}
                                        onCheckedChange={(v) => updateSetting('checkForUpdates', v)}
                                    />
                                </SettingRow>
                                <SettingRow label='Launch at startup' description='Start Git Graph when you log in'>
                                    <Switch
                                        checked={settings.launchAtStartup}
                                        onCheckedChange={(v) => updateSetting('launchAtStartup', v)}
                                    />
                                </SettingRow>
                                <SettingRow label='Lens Mode' description='Choose your interface experience level'>
                                    <select
                                        className='h-9 rounded-md border bg-transparent px-3 py-1 text-sm'
                                        value={settings.lensMode}
                                        onChange={(e) =>
                                            updateSetting('lensMode', e.target.value as 'guided' | 'craft' | 'control')
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
                                            updateSetting('theme', e.target.value as typeof settings.theme)
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
                                            updateSetting('graphTheme', e.target.value as typeof settings.graphTheme)
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
                                        onCheckedChange={(v) => updateSetting('showAvatars', v)}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Show relative dates'
                                    description="Use '2 days ago' instead of full dates">
                                    <Switch
                                        checked={settings.showRelativeDates}
                                        onCheckedChange={(v) => updateSetting('showRelativeDates', v)}
                                    />
                                </SettingRow>
                                <SettingRow label='Date format' description='How to display dates'>
                                    <select
                                        className='h-9 rounded-md border bg-transparent px-3 py-1 text-sm'
                                        value={settings.dateFormat}
                                        onChange={(e) =>
                                            updateSetting('dateFormat', e.target.value as typeof settings.dateFormat)
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
                                        onCheckedChange={(v) => updateSetting('enhancedAccessibility', v)}
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
                                            updateSetting('commitMessageLength', parseInt(e.target.value) || 0)
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
                                        onChange={(e) => updateSetting('defaultBranch', e.target.value)}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Auto-sign commits'
                                    description='Automatically sign commits with GPG/SSH key'>
                                    <Switch
                                        checked={settings.autoSignCommits}
                                        onCheckedChange={(v) => updateSetting('autoSignCommits', v)}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Commit template'
                                    description='Default template for new commit messages'>
                                    <textarea
                                        className='h-20 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm'
                                        placeholder='feat: &#10;&#10;'
                                        value={settings.commitTemplate}
                                        onChange={(e) => updateSetting('commitTemplate', e.target.value)}
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
                                        onChange={(e) => updateSetting('mergeTool', e.target.value)}
                                    />
                                </SettingRow>
                            </SettingsSection>
                        </TabsContent>

                        <TabsContent value='notifications' className='m-0 space-y-6'>
                            <SettingsSection title='Notifications' icon={<Bell className='h-4 w-4' />}>
                                <SettingRow label='Push notifications' description='Notify when push completes'>
                                    <Switch
                                        checked={settings.notifyOnPush}
                                        onCheckedChange={(v) => updateSetting('notifyOnPush', v)}
                                    />
                                </SettingRow>
                                <SettingRow label='Pull notifications' description='Notify when pull completes'>
                                    <Switch
                                        checked={settings.notifyOnPull}
                                        onCheckedChange={(v) => updateSetting('notifyOnPull', v)}
                                    />
                                </SettingRow>
                                <SettingRow label='Merge notifications' description='Notify when merge completes'>
                                    <Switch
                                        checked={settings.notifyOnMerge}
                                        onCheckedChange={(v) => updateSetting('notifyOnMerge', v)}
                                    />
                                </SettingRow>
                                <SettingRow label='Sound effects' description='Play sounds for notifications'>
                                    <Switch
                                        checked={settings.soundEnabled}
                                        onCheckedChange={(v) => updateSetting('soundEnabled', v)}
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
                                        onChange={(e) => updateSetting('maxCommits', parseInt(e.target.value) || 1000)}
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Enable virtualization'
                                    description='Use virtual scrolling for better performance'>
                                    <Switch
                                        checked={settings.enableVirtualization}
                                        onCheckedChange={(v) => updateSetting('enableVirtualization', v)}
                                    />
                                </SettingRow>
                                <SettingRow label='Lazy load images' description='Defer loading images until needed'>
                                    <Switch
                                        checked={settings.lazyLoadImages}
                                        onCheckedChange={(v) => updateSetting('lazyLoadImages', v)}
                                    />
                                </SettingRow>
                            </SettingsSection>
                        </TabsContent>

                        <TabsContent value='integrations' className='m-0 space-y-6'>
                            <SettingsSection title='Release Feature Flags' icon={<GitBranch className='h-4 w-4' />}>
                                <SettingRow
                                    label='Worktree Pro'
                                    description='Unified worktree center and advanced lifecycle actions'>
                                    <Switch
                                        checked={featureFlags.worktreePro}
                                        onCheckedChange={(value) =>
                                            setFeatureFlags((previous) => ({ ...previous, worktreePro: value }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Workflow Engine'
                                    description='Tower-style workflow templates and execution runs'>
                                    <Switch
                                        checked={featureFlags.workflowEngine}
                                        onCheckedChange={(value) =>
                                            setFeatureFlags((previous) => ({ ...previous, workflowEngine: value }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Graphite Interop'
                                    description='Stack sync, restack, and Graphite CLI interoperability'>
                                    <Switch
                                        checked={featureFlags.graphiteInterop}
                                        onCheckedChange={(value) =>
                                            setFeatureFlags((previous) => ({ ...previous, graphiteInterop: value }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='AI Production Features'
                                    description='Provider-backed commit/PR/conflict/commit-explain assistance'>
                                    <Switch
                                        checked={featureFlags.aiProd}
                                        onCheckedChange={(value) =>
                                            setFeatureFlags((previous) => ({ ...previous, aiProd: value }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Deep Links'
                                    description='App protocol links for repo/branch/commit context'>
                                    <Switch
                                        checked={featureFlags.deepLinks}
                                        onCheckedChange={(value) =>
                                            setFeatureFlags((previous) => ({ ...previous, deepLinks: value }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Branch Pinning'
                                    description='Pinned branches and smart branch ranking filters'>
                                    <Switch
                                        checked={featureFlags.branchPinning}
                                        onCheckedChange={(value) =>
                                            setFeatureFlags((previous) => ({ ...previous, branchPinning: value }))
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

                            <SettingsSection title='AI Provider' icon={<Globe className='h-4 w-4' />}>
                                <SettingRow
                                    label='Enable AI'
                                    description='Master switch for provider-backed AI assistance'>
                                    <Switch
                                        checked={aiConfig.enabled}
                                        onCheckedChange={(value) =>
                                            setAiConfig((previous) => ({ ...previous, enabled: value }))
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
                                            setAiConfig((previous) => ({
                                                ...previous,
                                                provider: event.target.value === 'self-host' ? 'self-host' : 'openai-compatible',
                                            }))
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
                                            setAiConfig((previous) => ({ ...previous, baseUrl: event.target.value }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow label='Model' description='Model identifier used for all AI features'>
                                    <Input
                                        className='w-48'
                                        value={aiConfig.model}
                                        onChange={(event) =>
                                            setAiConfig((previous) => ({ ...previous, model: event.target.value }))
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
                                            setAiConfig((previous) => ({
                                                ...previous,
                                                timeoutMs: Number.parseInt(event.target.value, 10) || previous.timeoutMs,
                                            }))
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
                                            setAiConfig((previous) => ({
                                                ...previous,
                                                maxTokens: Number.parseInt(event.target.value, 10) || previous.maxTokens,
                                            }))
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
                                            setAiConfig((previous) => ({
                                                ...previous,
                                                retries: Number.parseInt(event.target.value, 10) || 0,
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Redact Sensitive Paths'
                                    description='Redact local usernames and home paths before provider calls'>
                                    <Switch
                                        checked={aiConfig.redactSensitivePaths}
                                        onCheckedChange={(value) =>
                                            setAiConfig((previous) => ({ ...previous, redactSensitivePaths: value }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Commit Message Generation'
                                    description='Generate commit messages from staged diffs'>
                                    <Switch
                                        checked={aiConfig.featureToggles.commitMessage}
                                        onCheckedChange={(value) =>
                                            setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    commitMessage: value,
                                                },
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Pull Request Generation'
                                    description='Generate PR title/body from branch delta'>
                                    <Switch
                                        checked={aiConfig.featureToggles.pullRequest}
                                        onCheckedChange={(value) =>
                                            setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    pullRequest: value,
                                                },
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Conflict Explanation'
                                    description='Explain conflicts and suggest resolution paths'>
                                    <Switch
                                        checked={aiConfig.featureToggles.conflictExplain}
                                        onCheckedChange={(value) =>
                                            setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    conflictExplain: value,
                                                },
                                            }))
                                        }
                                    />
                                </SettingRow>
                                <SettingRow
                                    label='Explain Commit'
                                    description='Summarize commit intent and potential risk areas'>
                                    <Switch
                                        checked={aiConfig.featureToggles.explainCommit}
                                        onCheckedChange={(value) =>
                                            setAiConfig((previous) => ({
                                                ...previous,
                                                featureToggles: {
                                                    ...previous.featureToggles,
                                                    explainCommit: value,
                                                },
                                            }))
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
                                            onChange={(event) => setRuntimeApiKey(event.target.value)}
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
                                            <span className='text-emerald-600'>Configured</span>
                                        ) : (
                                            <span>Not configured</span>
                                        )}
                                    </span>
                                    {aiConfigQuery.data?.hasRuntimeKey && <Check className='h-3.5 w-3.5 text-emerald-600' />}
                                </div>
                                <div className='flex justify-end pt-2'>
                                    <Button onClick={handleSaveAiConfig} disabled={saveAIConfigMutation.isPending}>
                                        {saveAIConfigMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                                        Save AI Settings
                                    </Button>
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
                                        onCheckedChange={(v) => updateSetting('telemetryEnabled', v)}
                                    />
                                </SettingRow>
                                <SettingRow label='Crash reports' description='Automatically send crash reports'>
                                    <Switch
                                        checked={settings.crashReports}
                                        onCheckedChange={(v) => updateSetting('crashReports', v)}
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
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SettingsSection({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className='space-y-4'>
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
