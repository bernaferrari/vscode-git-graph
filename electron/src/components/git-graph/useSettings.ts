import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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

const STORAGE_KEY = 'git-graph-settings';

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
            } catch {
                setSettings(DEFAULT_SETTINGS);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, [settings]);

    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        toast.success('Settings reset to defaults');
    };

    return { settings, updateSetting, resetSettings };
}
