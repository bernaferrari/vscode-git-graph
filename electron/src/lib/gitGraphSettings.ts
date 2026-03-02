export const GIT_GRAPH_SETTINGS_STORAGE_KEY = 'git-graph-settings';
export const GIT_GRAPH_SETTINGS_UPDATED_EVENT = 'git-graph-settings-updated';

export type GitGraphTheme = 'light' | 'dark' | 'system';

export interface GitGraphUiSettings {
    theme: GitGraphTheme;
    enhancedAccessibility: boolean;
}

const DEFAULT_UI_SETTINGS: GitGraphUiSettings = {
    theme: 'system',
    enhancedAccessibility: false,
};

function normalizeTheme(value: unknown): GitGraphTheme {
    return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_UI_SETTINGS.theme;
}

export function readGitGraphUiSettingsFromStorage(): GitGraphUiSettings {
    if (typeof window === 'undefined') {
        return DEFAULT_UI_SETTINGS;
    }

    const stored = window.localStorage.getItem(GIT_GRAPH_SETTINGS_STORAGE_KEY);
    if (!stored) {
        return DEFAULT_UI_SETTINGS;
    }

    try {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        return {
            theme: normalizeTheme(parsed.theme),
            enhancedAccessibility: Boolean(parsed.enhancedAccessibility),
        };
    } catch {
        return DEFAULT_UI_SETTINGS;
    }
}
