/**
 * Avatar Manager
 * Ported from git-graph/src/avatarManager.ts
 * Manages fetching and caching Avatars in Electron
 */

import * as crypto from 'crypto';
import { app } from 'electron';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

import { Disposable, toDisposable } from '../../../src/lib/utils/disposable';
import { EventEmitter, type Event } from '../../../src/lib/utils/event';

export interface Avatar {
	image: string;
	timestamp: number;
	identicon: boolean;
}

export type AvatarCache = { [email: string]: Avatar };

export interface AvatarEvent {
	email: string;
	image: string;
}

interface AvatarRequestItem {
	email: string;
	repo: string;
	remote: string | null;
	commits: string[];
	checkAfter: number;
	attempts: number;
}

type RemoteSource =
	| { type: 'github'; owner: string; repo: string }
	| { type: 'gitlab' }
	| { type: 'gravatar' };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isAvatar(value: unknown): value is Avatar {
	if (!isRecord(value)) {
		return false;
	}
	return (
		typeof value.image === 'string' &&
		typeof value.timestamp === 'number' &&
		typeof value.identicon === 'boolean'
	);
}

function isAvatarCache(value: unknown): value is AvatarCache {
	if (!isRecord(value)) {
		return false;
	}
	return Object.values(value).every((entry) => isAvatar(entry));
}

/**
 * Manages fetching and caching Avatars.
 */
export class AvatarManager extends Disposable {
	private readonly avatarStorageFolder: string;
	private readonly avatarEventEmitter: EventEmitter<AvatarEvent>;
	private readonly logger: (message: string) => void;

	private avatars: AvatarCache = {};
	private queue: AvatarRequestItem[] = [];
	private interval: ReturnType<typeof setInterval> | null = null;

	constructor(
		logger: (message: string) => void = () => {}
	) {
		super();
		this.logger = logger;
		this.avatarStorageFolder = path.join(app.getPath('userData'), 'avatars');
		this.avatarEventEmitter = new EventEmitter<AvatarEvent>();

		// Ensure avatar storage folder exists
		if (!fs.existsSync(this.avatarStorageFolder)) {
			fs.mkdirSync(this.avatarStorageFolder, { recursive: true });
		}

		// Load cached avatars
		this.loadAvatarCache();

		this.registerDisposables(
			toDisposable(() => {
				this.stopInterval();
			}),
			this.avatarEventEmitter
		);
	}

	/**
	 * Get the Event that can be used to subscribe to receive requested avatars.
	 */
	get onAvatar(): Event<AvatarEvent> {
		return this.avatarEventEmitter.subscribe;
	}

	/**
	 * Fetch an avatar, either from the cache if it already exists, or queue it to be fetched.
	 */
	public fetchAvatarImage(
		email: string,
		repo: string,
		remote: string | null,
		commits: string[]
	): void {
		if (this.avatars[email]) {
			const t = Date.now();
			if (
				this.avatars[email].timestamp < t - 1209600000 ||
				(this.avatars[email].identicon && this.avatars[email].timestamp < t - 345600000)
			) {
				this.addToQueue(email, repo, remote, commits, false);
			}
			this.emitAvatar(email).catch(() => {
				this.removeAvatarFromCache(email);
				this.addToQueue(email, repo, remote, commits, true);
			});
		} else {
			this.addToQueue(email, repo, remote, commits, true);
		}
	}

	/**
	 * Get the image data of an avatar.
	 */
	public async getAvatarImage(email: string): Promise<string | null> {
		const avatar = this.avatars[email];
		if (!avatar || !avatar.image) {
			return null;
		}

		return new Promise((resolve) => {
			const imagePath = path.join(this.avatarStorageFolder, avatar.image);
				fs.readFile(imagePath, (err, data) => {
					if (err) {
						resolve(null);
					} else {
						const format = avatar.image.split('.')[1] ?? 'png';
						resolve(`data:image/${format};base64,${data.toString('base64')}`);
					}
				});
			});
		}

	/**
	 * Remove all avatars from the cache.
	 */
	public clearCache(): void {
		this.avatars = {};
		this.saveAvatarCache();

		// Delete all avatar files
		if (fs.existsSync(this.avatarStorageFolder)) {
			const files = fs.readdirSync(this.avatarStorageFolder);
			for (const file of files) {
				if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
					fs.unlinkSync(path.join(this.avatarStorageFolder, file));
				}
			}
		}
	}

	/**
	 * Add an avatar request to the queue.
	 */
	private addToQueue(
		email: string,
		repo: string,
		remote: string | null,
		commits: string[],
		immediate: boolean
	): void {
		const existingRequest = this.queue.find((r) => r.email === email && r.repo === repo);
		if (existingRequest) {
			commits.forEach((commit) => {
				if (!existingRequest.commits.includes(commit)) {
					existingRequest.commits.push(commit);
				}
			});
		} else {
				this.insertQueueItem({
					email,
					repo,
					remote,
					commits,
					checkAfter: immediate || this.queue.length === 0
						? 0
						: (this.queue[this.queue.length - 1]?.checkAfter ?? 0) + 1,
					attempts: 0,
				});
			}

		this.startInterval();
	}

	/**
	 * Start the interval for fetching avatars.
	 */
	private startInterval(): void {
		if (this.interval !== null) return;

			this.interval = setInterval(() => {
				void this.fetchAvatarsInterval();
			}, 10000);
			void this.fetchAvatarsInterval();
		}

	/**
	 * Stop the interval.
	 */
	private stopInterval(): void {
		if (this.interval !== null) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	/**
	 * Fetch avatars from the queue.
	 */
	private async fetchAvatarsInterval(): Promise<void> {
		if (this.queue.length === 0) {
			this.stopInterval();
			return;
		}

		const item = this.queue.shift();
		if (!item) return;

		// Try GitHub API first if we have repo info
		if (item.remote) {
			const remoteSource = this.getRemoteSource(item.remote);
			if (remoteSource.type === 'github') {
				const success = await this.fetchFromGithub(item, remoteSource.owner, remoteSource.repo);
				if (success) return;
			} else if (remoteSource.type === 'gitlab') {
				const success = await this.fetchFromGitLab(item);
				if (success) return;
			}
		}

		// Fall back to Gravatar
		await this.fetchFromGravatar(item);
	}

	/**
	 * Determine remote source from remote URL
	 */
	private getRemoteSource(remoteUrl: string): RemoteSource {
		// GitHub HTTPS
		const githubHttps = remoteUrl.match(/https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
		if (githubHttps) {
			return { type: 'github', owner: githubHttps[1] ?? '', repo: githubHttps[2] ?? '' };
		}

		// GitHub SSH
		const githubSsh = remoteUrl.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
		if (githubSsh) {
			return { type: 'github', owner: githubSsh[1] ?? '', repo: githubSsh[2] ?? '' };
		}

		// GitLab HTTPS
		const gitlabHttps = remoteUrl.match(/https?:\/\/gitlab\.com\/(.+)/);
		if (gitlabHttps) {
			return { type: 'gitlab' };
		}

		// GitLab SSH
		const gitlabSsh = remoteUrl.match(/git@gitlab\.com:(.+)/);
		if (gitlabSsh) {
			return { type: 'gitlab' };
		}

		return { type: 'gravatar' };
	}

	/**
	 * Fetch avatar from GitHub API
	 */
	private async fetchFromGithub(item: AvatarRequestItem, owner: string, repo: string): Promise<boolean> {
		this.logger(`Requesting Avatar for ${maskEmail(item.email)} from GitHub API`);

		return new Promise((resolve) => {
			https.get({
				hostname: 'api.github.com',
				path: `/repos/${owner}/${repo}/commits?author=${encodeURIComponent(item.email)}&per_page=1`,
				headers: {
					'User-Agent': 'vscode-git-graph-electron',
					Accept: 'application/vnd.github.v3+json',
				},
				timeout: 15000,
				}, (res) => {
					let data = '';
					res.on('data', (chunk: Buffer | string) => {
						data += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
					});
					res.on('end', () => {
						void (async () => {
							try {
								const commits: unknown = JSON.parse(data);
								const firstCommit = Array.isArray(commits) ? (commits as unknown[])[0] : undefined;
								const firstCommitRecord = isRecord(firstCommit) ? firstCommit : {};
								const author = isRecord(firstCommitRecord.author) ? firstCommitRecord.author : {};
								const avatarUrl = typeof author.avatar_url === 'string'
									? `${author.avatar_url}&size=162`
									: null;
								if (avatarUrl) {
									const img = await this.downloadAvatarImage(item.email, avatarUrl);
									if (img) {
										this.saveAvatar(item.email, img, false);
										resolve(true);
										return;
									}
								}
							} catch {
								// Fall through to return false
							}
							resolve(false);
						})();
					});
					res.on('error', () => { resolve(false); });
				}).on('error', () => { resolve(false); });
			});
		}

	/**
	 * Fetch avatar from GitLab API
	 */
	private async fetchFromGitLab(item: AvatarRequestItem): Promise<boolean> {
		this.logger(`Requesting Avatar for ${maskEmail(item.email)} from GitLab API`);

		return new Promise((resolve) => {
			https.get({
				hostname: 'gitlab.com',
				path: `/api/v4/avatar?email=${encodeURIComponent(item.email)}&size=162`,
				headers: {
					'User-Agent': 'vscode-git-graph-electron',
				},
				timeout: 15000,
				}, (res) => {
					let data = '';
					res.on('data', (chunk: Buffer | string) => {
						data += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
					});
					res.on('end', () => {
						void (async () => {
							try {
								const result: unknown = JSON.parse(data);
								const resultRecord = isRecord(result) ? result : {};
								const avatarUrl = typeof resultRecord.avatar_url === 'string'
									? resultRecord.avatar_url
									: null;
								if (avatarUrl) {
									const img = await this.downloadAvatarImage(item.email, avatarUrl);
									if (img) {
										this.saveAvatar(item.email, img, false);
										resolve(true);
										return;
									}
								}
							} catch {
								// Fall through to return false
							}
							resolve(false);
						})();
					});
					res.on('error', () => { resolve(false); });
				}).on('error', () => { resolve(false); });
			});
		}

	/**
	 * Fetch an avatar from Gravatar.
	 */
	private async fetchFromGravatar(item: AvatarRequestItem): Promise<void> {
		this.logger(`Requesting Avatar for ${maskEmail(item.email)} from Gravatar`);

		const hash = crypto.createHash('md5').update(item.email.trim().toLowerCase()).digest('hex');

		let img = await this.downloadAvatarImage(
			item.email,
			`https://secure.gravatar.com/avatar/${hash}?s=162&d=404`
		);
		let identicon = false;

		if (!img) {
			img = await this.downloadAvatarImage(
				item.email,
				`https://secure.gravatar.com/avatar/${hash}?s=162&d=identicon`
			);
			identicon = true;
		}

		if (img) {
			this.saveAvatar(item.email, img, identicon);
		} else {
			this.logger(`No Avatar could be found for ${maskEmail(item.email)}`);
		}
	}

	/**
	 * Download and save an avatar image.
	 */
	private downloadAvatarImage(email: string, imageUrl: string): Promise<string | null> {
		return new Promise((resolve) => {
			const hash = crypto.createHash('md5').update(email).digest('hex');

				https.get(imageUrl, {
					headers: { 'User-Agent': 'vscode-git-graph-electron' },
					timeout: 15000,
				}, (res) => {
					const chunks: Buffer[] = [];
					res.on('data', (chunk: Buffer | string) => {
						chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
					});
				res.on('end', () => {
					if (res.statusCode === 200) {
						const contentType = res.headers['content-type'];
						const format = contentType?.split('/')[1] ?? 'png';
						const fileName = `${hash}.${format}`;
						const filePath = path.join(this.avatarStorageFolder, fileName);

						fs.writeFile(filePath, Buffer.concat(chunks), (err) => {
							resolve(err ? null : fileName);
						});
					} else {
						resolve(null);
					}
				});
				res.on('error', () => { resolve(null); });
			}).on('error', () => { resolve(null); });
		});
	}

	/**
	 * Save an avatar in the cache.
	 */
	private saveAvatar(email: string, image: string, identicon: boolean): void {
		if (this.avatars[email]) {
			if (!identicon || this.avatars[email].identicon) {
				this.avatars[email].image = image;
				this.avatars[email].identicon = identicon;
			}
			this.avatars[email].timestamp = Date.now();
		} else {
			this.avatars[email] = {
				image,
				timestamp: Date.now(),
				identicon,
			};
		}

			this.saveAvatarCache();
			this.logger(`Saved Avatar for ${maskEmail(email)}`);
			void this.emitAvatar(email);
		}

	/**
	 * Emit an AvatarEvent to any listeners.
	 */
	private async emitAvatar(email: string): Promise<void> {
		if (!this.avatarEventEmitter.hasSubscribers()) return;

		const image = await this.getAvatarImage(email);
		if (image) {
			this.avatarEventEmitter.emit({ email, image });
		}
	}

	/**
	 * Remove an avatar from the cache.
	 */
	private removeAvatarFromCache(email: string): void {
		this.avatars = Object.fromEntries(
			Object.entries(this.avatars).filter(([cachedEmail]) => cachedEmail !== email)
		);
		this.saveAvatarCache();
	}

	/**
	 * Load avatar cache from disk.
	 */
	private loadAvatarCache(): void {
		const cachePath = path.join(this.avatarStorageFolder, 'cache.json');
			if (fs.existsSync(cachePath)) {
				try {
					const data = fs.readFileSync(cachePath, 'utf-8');
					const parsed: unknown = JSON.parse(data);
					this.avatars = isAvatarCache(parsed) ? parsed : {};
				} catch {
					this.avatars = {};
				}
			}
		}

	/**
	 * Save avatar cache to disk.
	 */
	private saveAvatarCache(): void {
		const cachePath = path.join(this.avatarStorageFolder, 'cache.json');
		fs.writeFileSync(cachePath, JSON.stringify(this.avatars));
	}

	/**
	 * Insert an item into the queue (sorted by checkAfter).
	 */
	private insertQueueItem(item: AvatarRequestItem): void {
			let l = 0;
			let r = this.queue.length - 1;

			while (l <= r) {
				const c = (l + r) >> 1;
				if ((this.queue[c]?.checkAfter ?? Number.MAX_SAFE_INTEGER) <= item.checkAfter) {
					l = c + 1;
				} else {
					r = c - 1;
				}
		}

		this.queue.splice(l, 0, item);
	}
}

/**
 * Mask an email address for logging.
 */
function maskEmail(email: string): string {
	const atIndex = email.indexOf('@');
	if (atIndex === -1) return email;
	return email.substring(0, atIndex) + '@*****';
}

// Singleton instance
let avatarManagerInstance: AvatarManager | null = null;

export function getAvatarManager(logger?: (message: string) => void): AvatarManager {
	if (!avatarManagerInstance) {
		avatarManagerInstance = new AvatarManager(logger);
	}
	return avatarManagerInstance;
}

export function resetAvatarManager(): void {
	avatarManagerInstance = null;
}
