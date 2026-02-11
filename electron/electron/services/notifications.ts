/**
 * Notifications Manager
 * Native notifications for Git events
 */

import { Notification, nativeImage, app } from 'electron';
import path from 'path';

export interface NotificationOptions {
	title: string;
	body: string;
	icon?: string;
	sound?: boolean;
	onClick?: () => void;
	actions?: Array<{
		type: 'button';
		text: string;
	}>;
}

export type NotificationType =
	| 'push-success'
	| 'push-failed'
	| 'pull-success'
	| 'pull-failed'
	| 'fetch-complete'
	| 'merge-conflict'
	| 'rebase-conflict'
	| 'branch-created'
	| 'branch-deleted'
	| 'tag-created'
	| 'stash-saved'
	| 'stash-applied'
	| 'ci-success'
	| 'ci-failed'
	| 'pr-created'
	| 'pr-merged';

class NotificationsManager {
	private isEnabled: boolean = true;
	private soundEnabled: boolean = true;

	constructor() {
		this.loadSettings();
	}

	private loadSettings() {
		// Load from store
		// this.isEnabled = store.get('notifications.enabled', true);
		// this.soundEnabled = store.get('notifications.sound', true);
	}

	/**
	 * Show a notification
	 */
	show(options: NotificationOptions): Notification | null {
		if (!this.isEnabled) return null;

		const notification = new Notification({
			title: options.title,
			body: options.body,
			icon: options.icon ? nativeImage.createFromPath(options.icon) : this.getDefaultIcon(),
			sound: options.sound ?? this.soundEnabled,
			actions: options.actions,
		});

		if (options.onClick) {
			notification.on('click', options.onClick);
		}

		notification.show();
		return notification;
	}

	/**
	 * Show a typed notification with preset options
	 */
	showTyped(type: NotificationType, data?: Record<string, string>): Notification | null {
		const config = this.getNotificationConfig(type, data);
		return this.show(config);
	}

	private getNotificationConfig(type: NotificationType, data?: Record<string, string>): NotificationOptions {
		const configs: Record<NotificationType, NotificationOptions> = {
			'push-success': {
				title: 'Push Successful',
				body: `Successfully pushed ${data?.branch || 'changes'} to ${data?.remote || 'remote'}`,
			},
			'push-failed': {
				title: 'Push Failed',
				body: `Failed to push to ${data?.remote || 'remote'}: ${data?.error || 'Unknown error'}`,
				sound: true,
			},
			'pull-success': {
				title: 'Pull Successful',
				body: `Successfully pulled ${data?.commits || 'changes'} from ${data?.remote || 'remote'}`,
			},
			'pull-failed': {
				title: 'Pull Failed',
				body: `Failed to pull from ${data?.remote || 'remote'}: ${data?.error || 'Unknown error'}`,
				sound: true,
			},
			'fetch-complete': {
				title: 'Fetch Complete',
				body: `Fetched ${data?.remote || 'all remotes'}`,
			},
			'merge-conflict': {
				title: 'Merge Conflict',
				body: `Conflicts detected while merging ${data?.branch || ''}. Manual resolution required.`,
				sound: true,
			},
			'rebase-conflict': {
				title: 'Rebase Conflict',
				body: `Conflicts detected during rebase. Manual resolution required.`,
				sound: true,
			},
			'branch-created': {
				title: 'Branch Created',
				body: `Created branch "${data?.branch || ''}"`,
			},
			'branch-deleted': {
				title: 'Branch Deleted',
				body: `Deleted branch "${data?.branch || ''}"`,
			},
			'tag-created': {
				title: 'Tag Created',
				body: `Created tag "${data?.tag || ''}"`,
			},
			'stash-saved': {
				title: 'Stash Saved',
				body: `Changes stashed: ${data?.message || 'No message'}`,
			},
			'stash-applied': {
				title: 'Stash Applied',
				body: `Applied stash: ${data?.stash || ''}`,
			},
			'ci-success': {
				title: 'Build Passed',
				body: `${data?.branch || 'Pipeline'} passed all checks`,
			},
			'ci-failed': {
				title: 'Build Failed',
				body: `${data?.branch || 'Pipeline'} failed: ${data?.error || ''}`,
				sound: true,
			},
			'pr-created': {
				title: 'Pull Request Created',
				body: `Created PR #${data?.pr || ''}: ${data?.title || ''}`,
			},
			'pr-merged': {
				title: 'Pull Request Merged',
				body: `PR #${data?.pr || ''} has been merged`,
			},
		};

		return configs[type];
	}

	private getDefaultIcon(): nativeImage {
		const iconPath = app.isPackaged
			? path.join(process.resourcesPath, 'icon.png')
			: path.join(__dirname, '../../../public/icon.png');
		return nativeImage.createFromPath(iconPath);
	}

	/**
	 * Enable/disable notifications
	 */
	setEnabled(enabled: boolean) {
		this.isEnabled = enabled;
	}

	/**
	 * Enable/disable notification sounds
	 */
	setSoundEnabled(enabled: boolean) {
		this.soundEnabled = enabled;
	}

	/**
	 * Check if notifications are supported
	 */
	isSupported(): boolean {
		return Notification.isSupported();
	}
}

// Singleton
let notificationsManager: NotificationsManager | null = null;

export function getNotificationsManager(): NotificationsManager {
	if (!notificationsManager) {
		notificationsManager = new NotificationsManager();
	}
	return notificationsManager;
}

export default NotificationsManager;
