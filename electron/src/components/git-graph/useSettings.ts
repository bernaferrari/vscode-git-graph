import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { trpc } from '@/trpc/client';

export interface AppSettings {
    // General
    confirmDestructiveActions: boolean;
    autoFetchInterval: number;
    checkForUpdates: boolean;
    launchAtStartup: boolean;

    // Lens Mode
    lensMode: 'guided' | 'craft' | 'control';

    // Appearance
    theme: 'light' | 'dark' | 'system';
    graphTheme: 'default' | 'colorful' | 'minimal';
    commitMessageLength: number;
    showAvatars: boolean;
    showRelativeDates: boolean;
    dateFormat: 'relative' | 'iso' | 'locale';
    enhancedAccessibility: boolean;

    // Editor
    commitTemplate: string;
    autoSignCommits: boolean;
    defaultBranch: string;
    mergeTool: string;

    // Notifications
    notifyOnPush: boolean;
    notifyOnPull: boolean;
    notifyOnMerge: boolean;
    soundEnabled: boolean;

    // Performance
    maxCommits: number;
    enableVirtualization: boolean;
    lazyLoadImages: boolean;

    // Privacy
    telemetryEnabled: boolean;
    crashReports: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    confirmDestructiveActions: true,
    autoFetchInterval: 5,
    checkForUpdates: true,
    launchAtStartup: false,
    lensMode: 'craft',
    theme: 'system',
    graphTheme: 'default',
    commitMessageLength: 72,
    showAvatars: true,
    showRelativeDates: true,
    dateFormat: 'relative',
    enhancedAccessibility: false,
    commitTemplate: '',
    autoSignCommits: false,
    defaultBranch: 'main',
    mergeTool: '',
    notifyOnPush: true,
    notifyOnPull: true,
    notifyOnMerge: true,
    soundEnabled: false,
    maxCommits: 1000,
    enableVirtualization: true,
    lazyLoadImages: true,
    telemetryEnabled: false,
    crashReports: true,
};

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const utils = trpc.useUtils();
    const settingsQuery = trpc.config.settings.useQuery(undefined, { staleTime: 10_000 });
    const setSettingsMutation = trpc.config.setSettings.useMutation({
        onSuccess: async () => {
            await utils.config.settings.invalidate();
        },
    });

    useEffect(() => {
        const stored = settingsQuery.data?.settings;
        if (stored) {
            setSettings({ ...DEFAULT_SETTINGS, ...stored });
        }
    }, [settingsQuery.data?.settings]);

    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings((prev) => {
            const next = { ...prev, [key]: value };
            setSettingsMutation.mutate(next);
            return next;
        });
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        setSettingsMutation.mutate(DEFAULT_SETTINGS);
        toast.success('Settings reset to defaults');
    };

    return { settings, updateSetting, resetSettings };
}
