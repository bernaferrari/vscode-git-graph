/**
 * i18n React Hook
 * Provides translation functions to React components
 */

import { useState, useEffect, useCallback } from 'react';

// Simple translation type
type TranslationKey = string;

// Client-side translations (mirrors backend)
const translations: Record<string, string> = {
	// Common
	'common.cancel': 'Cancel',
	'common.save': 'Save',
	'common.delete': 'Delete',
	'common.edit': 'Edit',
	'common.close': 'Close',
	'common.confirm': 'Confirm',
	'common.yes': 'Yes',
	'common.no': 'No',
	'common.ok': 'OK',
	'common.loading': 'Loading...',
	'common.error': 'Error',
	'common.success': 'Success',
	'common.search': 'Search',
	'common.filter': 'Filter',
	'common.all': 'All',
	'common.none': 'None',
	'common.copied': 'Copied to clipboard',
	
	// Git Graph
	'gitGraph.title': 'Git Graph',
	'gitGraph.noRepoSelected': 'No Repository Selected',
	'gitGraph.noRepoSelectedDesc': 'Open a Git repository to view the commit graph',
	'gitGraph.openRepo': 'Open Repository',
	'gitGraph.loading': 'Loading...',
	'gitGraph.noCommits': 'No commits found',
	'gitGraph.refresh': 'Refresh',
	'gitGraph.find': 'Find',
	'gitGraph.scrollToHead': 'Scroll to HEAD',
	'gitGraph.scrollToStash': 'Scroll to Stash',
	
	// Commits
	'commit.uncommittedChanges': 'Uncommitted Changes',
	'commit.copyHash': 'Copy Hash',
	'commit.copySubject': 'Copy Subject',
	'commit.addTag': 'Add Tag...',
	'commit.createBranch': 'Create Branch...',
	'commit.checkout': 'Checkout',
	'commit.cherryPick': 'Cherry Pick...',
	'commit.revert': 'Revert...',
	'commit.merge': 'Merge...',
	'commit.rebase': 'Rebase...',
	'commit.reset': 'Reset...',
	'commit.drop': 'Drop',
	
	// Branches
	'branch.local': 'Local',
	'branch.remote': 'Remote',
	'branch.current': 'current',
	'branch.checkout': 'Checkout',
	'branch.rename': 'Rename...',
	'branch.delete': 'Delete',
	'branch.merge': 'Merge...',
	'branch.rebase': 'Rebase...',
	'branch.push': 'Push',
	'branch.pull': 'Pull',
	'branch.fetch': 'Fetch',
	'branch.create': 'Create Branch...',
	
	// Tags
	'tag.create': 'Create Tag...',
	'tag.delete': 'Delete',
	'tag.push': 'Push to Remote',
	'tag.annotated': 'Annotated',
	'tag.lightweight': 'Lightweight',
	
	// Stashes
	'stash.apply': 'Apply',
	'stash.pop': 'Pop',
	'stash.drop': 'Drop',
	'stash.push': 'Stash',
	'stash.includeUntracked': 'Include untracked files',
	
	// Dialogs
	'dialog.createBranch': 'Create Branch',
	'dialog.branchName': 'Branch Name',
	'dialog.checkoutAfterCreate': 'Checkout after creation',
	'dialog.addTag': 'Add Tag',
	'dialog.tagName': 'Tag Name',
	'dialog.tagType': 'Tag Type',
	'dialog.pushToRemote': 'Push to remote',
	'dialog.reset': 'Reset to Commit',
	'dialog.resetMode': 'Reset Mode',
	'dialog.soft': 'Soft - Keep all changes staged',
	'dialog.mixed': 'Mixed - Keep changes but unstage',
	'dialog.hard': 'Hard - Discard all changes',
	'dialog.deleteBranch': 'Delete Branch',
	'dialog.forceDelete': 'Force delete (branch is not merged)',
	'dialog.merge': 'Merge Branch',
	'dialog.noFastForward': 'No fast-forward (create merge commit)',
	'dialog.squashCommits': 'Squash commits',
	'dialog.noCommit': 'No commit (stage changes only)',
	'dialog.rebase': 'Rebase',
	'dialog.interactive': 'Interactive rebase',
	'dialog.cherryPick': 'Cherry Pick',
	'dialog.revert': 'Revert Commit',
	
	// Settings
	'settings.title': 'Settings',
	'settings.general': 'General',
	'settings.graph': 'Graph',
	'settings.repository': 'Repository',
	'settings.dialogs': 'Dialogs',
	'settings.dateFormat': 'Date Format',
	'settings.dateType': 'Date Type',
	'settings.graphStyle': 'Graph Style',
	'settings.branchColors': 'Branch Colors',
	'settings.showRemoteBranches': 'Show Remote Branches',
	'settings.showStashes': 'Show Stashes',
	'settings.showTags': 'Show Tags',
	'settings.enhancedAccessibility': 'Enhanced Accessibility',
	'settings.renderMarkdown': 'Render Markdown in commit messages',
};

/**
 * Translation function
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
	let text = translations[key] ?? key;
	
	if (params) {
		Object.entries(params).forEach(([k, v]) => {
			text = text.replace(`{${k}}`, String(v));
		});
	}
	
	return text;
}

/**
 * React hook for translations
 */
export function useTranslation() {
	const [locale, setLocale] = useState<string>('en');
	
	// Could fetch translations from backend here
	useEffect(() => {
		// Load saved locale preference
		const saved = localStorage.getItem('git-graph-locale');
		if (saved) {
			setLocale(saved);
		}
	}, []);
	
	const changeLocale = useCallback((newLocale: string) => {
		setLocale(newLocale);
		localStorage.setItem('git-graph-locale', newLocale);
	}, []);
	
	return {
		t,
		locale,
		setLocale: changeLocale,
	};
}
