/**
 * Internationalization (i18n) Service
 * Provides translation support for the Git Graph application
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh-CN' | 'zh-TW' | 'ko' | 'pt-BR' | 'ru';

export interface Translations {
	// Common
	common: {
		cancel: string;
		save: string;
		delete: string;
		edit: string;
		close: string;
		confirm: string;
		yes: string;
		no: string;
		ok: string;
		loading: string;
		error: string;
		success: string;
		search: string;
		filter: string;
		all: string;
		none: string;
		copied: string;
	};
	// Git Graph
	gitGraph: {
		title: string;
		noRepoSelected: string;
		noRepoSelectedDesc: string;
		openRepo: string;
		loading: string;
		noCommits: string;
		refresh: string;
		find: string;
		scrollToHead: string;
		scrollToStash: string;
	};
	// Commits
	commit: {
		uncommittedChanges: string;
		copyHash: string;
		copySubject: string;
		addTag: string;
		createBranch: string;
		checkout: string;
		cherryPick: string;
		revert: string;
		merge: string;
		rebase: string;
		reset: string;
		drop: string;
	};
	// Branches
	branch: {
		local: string;
		remote: string;
		current: string;
		checkout: string;
		rename: string;
		delete: string;
		merge: string;
		rebase: string;
		push: string;
		pull: string;
		fetch: string;
		create: string;
	};
	// Tags
	tag: {
		create: string;
		delete: string;
		push: string;
		annotated: string;
		lightweight: string;
	};
	// Stashes
	stash: {
		apply: string;
		pop: string;
		drop: string;
		push: string;
		includeUntracked: string;
	};
	// Dialogs
	dialog: {
		createBranch: string;
		branchName: string;
		checkoutAfterCreate: string;
		addTag: string;
		tagName: string;
		tagType: string;
		pushToRemote: string;
		reset: string;
		resetMode: string;
		soft: string;
		mixed: string;
		hard: string;
		deleteBranch: string;
		forceDelete: string;
		merge: string;
		noFastForward: string;
		squashCommits: string;
		noCommit: string;
		rebase: string;
		interactive: string;
		cherryPick: string;
		revert: string;
	};
	// Settings
	settings: {
		title: string;
		general: string;
		graph: string;
		repository: string;
		dialogs: string;
		dateFormat: string;
		dateType: string;
		graphStyle: string;
		branchColors: string;
		showRemoteBranches: string;
		showStashes: string;
		showTags: string;
		enhancedAccessibility: string;
		renderMarkdown: string;
	};
}

// English translations (default)
const enTranslations: Translations = {
	common: {
		cancel: 'Cancel',
		save: 'Save',
		delete: 'Delete',
		edit: 'Edit',
		close: 'Close',
		confirm: 'Confirm',
		yes: 'Yes',
		no: 'No',
		ok: 'OK',
		loading: 'Loading...',
		error: 'Error',
		success: 'Success',
		search: 'Search',
		filter: 'Filter',
		all: 'All',
		none: 'None',
		copied: 'Copied to clipboard',
	},
	gitGraph: {
		title: 'Git Graph',
		noRepoSelected: 'No Repository Selected',
		noRepoSelectedDesc: 'Open a Git repository to view the commit graph',
		openRepo: 'Open Repository',
		loading: 'Loading...',
		noCommits: 'No commits found',
		refresh: 'Refresh',
		find: 'Find',
		scrollToHead: 'Scroll to HEAD',
		scrollToStash: 'Scroll to Stash',
	},
	commit: {
		uncommittedChanges: 'Uncommitted Changes',
		copyHash: 'Copy Hash',
		copySubject: 'Copy Subject',
		addTag: 'Add Tag...',
		createBranch: 'Create Branch...',
		checkout: 'Checkout',
		cherryPick: 'Cherry Pick...',
		revert: 'Revert...',
		merge: 'Merge...',
		rebase: 'Rebase...',
		reset: 'Reset...',
		drop: 'Drop',
	},
	branch: {
		local: 'Local',
		remote: 'Remote',
		current: 'current',
		checkout: 'Checkout',
		rename: 'Rename...',
		delete: 'Delete',
		merge: 'Merge...',
		rebase: 'Rebase...',
		push: 'Push',
		pull: 'Pull',
		fetch: 'Fetch',
		create: 'Create Branch...',
	},
	tag: {
		create: 'Create Tag...',
		delete: 'Delete',
		push: 'Push to Remote',
		annotated: 'Annotated',
		lightweight: 'Lightweight',
	},
	stash: {
		apply: 'Apply',
		pop: 'Pop',
		drop: 'Drop',
		push: 'Stash',
		includeUntracked: 'Include untracked files',
	},
	dialog: {
		createBranch: 'Create Branch',
		branchName: 'Branch Name',
		checkoutAfterCreate: 'Checkout after creation',
		addTag: 'Add Tag',
		tagName: 'Tag Name',
		tagType: 'Tag Type',
		pushToRemote: 'Push to remote',
		reset: 'Reset to Commit',
		resetMode: 'Reset Mode',
		soft: 'Soft - Keep all changes staged',
		mixed: 'Mixed - Keep changes but unstage',
		hard: 'Hard - Discard all changes',
		deleteBranch: 'Delete Branch',
		forceDelete: 'Force delete (branch is not merged)',
		merge: 'Merge Branch',
		noFastForward: 'No fast-forward (create merge commit)',
		squashCommits: 'Squash commits',
		noCommit: 'No commit (stage changes only)',
		rebase: 'Rebase',
		interactive: 'Interactive rebase',
		cherryPick: 'Cherry Pick',
		revert: 'Revert Commit',
	},
	settings: {
		title: 'Settings',
		general: 'General',
		graph: 'Graph',
		repository: 'Repository',
		dialogs: 'Dialogs',
		dateFormat: 'Date Format',
		dateType: 'Date Type',
		graphStyle: 'Graph Style',
		branchColors: 'Branch Colors',
		showRemoteBranches: 'Show Remote Branches',
		showStashes: 'Show Stashes',
		showTags: 'Show Tags',
		enhancedAccessibility: 'Enhanced Accessibility',
		renderMarkdown: 'Render Markdown in commit messages',
	},
};

// All translations
const translations: Record<Locale, Translations> = {
	en: enTranslations,
	es: enTranslations, // Placeholder - would be translated
	fr: enTranslations, // Placeholder
	de: enTranslations, // Placeholder
	ja: enTranslations, // Placeholder
	'zh-CN': enTranslations, // Placeholder
	'zh-TW': enTranslations, // Placeholder
	ko: enTranslations, // Placeholder
	'pt-BR': enTranslations, // Placeholder
	ru: enTranslations, // Placeholder
};

/**
 * i18n Manager
 */
export class I18nManager {
	private locale: Locale = 'en';
	private translations: Translations = translations.en;

	/**
	 * Set the current locale
	 */
	public setLocale(locale: Locale): void {
		this.locale = locale;
		this.translations = translations[locale] ?? translations.en;
	}

	/**
	 * Get the current locale
	 */
	public getLocale(): Locale {
		return this.locale;
	}

	/**
	 * Get all available locales
	 */
	public getAvailableLocales(): Locale[] {
		return Object.keys(translations) as Locale[];
	}

	/**
	 * Get translations
	 */
	public getTranslations(): Translations {
		return this.translations;
	}

	/**
	 * Get a translation by key path (e.g., 'common.cancel')
	 */
	public t(key: string): string {
		const parts = key.split('.');
		let value: unknown = this.translations;

		for (const part of parts) {
			if (typeof value === 'object' && value !== null && part in value) {
				value = (value as Record<string, unknown>)[part];
			} else {
				return key; // Return key if not found
			}
		}

		return typeof value === 'string' ? value : key;
	}

	/**
	 * Detect system locale
	 */
	public detectSystemLocale(): Locale {
		const systemLocale = app.getLocale();
		
		// Map system locale to supported locale
		const localeMap: Record<string, Locale> = {
			en: 'en',
			'en-US': 'en',
			'en-GB': 'en',
			es: 'es',
			'es-ES': 'es',
			fr: 'fr',
			'fr-FR': 'fr',
			de: 'de',
			'de-DE': 'de',
			ja: 'ja',
			'ja-JP': 'ja',
			ko: 'ko',
			'ko-KR': 'ko',
			ru: 'ru',
			'ru-RU': 'ru',
			'pt-BR': 'pt-BR',
			'zh-CN': 'zh-CN',
			'zh-TW': 'zh-TW',
		};

		return localeMap[systemLocale] ?? 'en';
	}
}

// Singleton instance
let i18nInstance: I18nManager | null = null;

export function getI18n(): I18nManager {
	if (!i18nInstance) {
		i18nInstance = new I18nManager();
		i18nInstance.setLocale(i18nInstance.detectSystemLocale());
	}
	return i18nInstance;
}

export function resetI18n(): void {
	i18nInstance = null;
}
