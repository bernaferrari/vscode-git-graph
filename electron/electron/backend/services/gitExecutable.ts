/**
 * Git Executable Discovery and Version Management
 * Ported from git-graph/src/utils.ts
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ==================== Types ====================

export interface GitExecutable {
	readonly path: string;
	readonly version: string;
}

export enum GitVersionRequirement {
	FetchAndPruneTags = '2.17.0',
	GpgInfo = '2.4.0',
	PushStash = '2.13.2',
	TagDetails = '1.7.8',
}

// ==================== Git Discovery ====================

const UNABLE_TO_FIND_GIT_MSG =
	'Unable to find a Git executable. Please ensure Git is installed and available in your PATH.';

/**
 * Find a Git executable that the app can use.
 */
export async function findGit(): Promise<GitExecutable> {
	// Try to find git in PATH
	const gitInPath = await findGitInPath();
	if (gitInPath) {
		return gitInPath;
	}

	// Platform-specific discovery
	switch (process.platform) {
		case 'darwin':
			return findGitOnDarwin();
		case 'win32':
			return findGitOnWin32();
		default:
			return getGitExecutable('git');
	}
}

/**
 * Find git in system PATH.
 */
async function findGitInPath(): Promise<GitExecutable | null> {
	const pathEnv = process.env['PATH'] || '';
	const separator = process.platform === 'win32' ? ';' : ':';
	const paths = pathEnv.split(separator);

	const gitName = process.platform === 'win32' ? 'git.exe' : 'git';

	for (const p of paths) {
		if (!p) continue;
		const gitPath = path.join(p, gitName);
		try {
			if (await isExecutable(gitPath)) {
				return await getGitExecutable(gitPath);
			}
		} catch {
			// Continue to next path
		}
	}

	return null;
}

/**
 * Find Git on macOS.
 */
async function findGitOnDarwin(): Promise<GitExecutable> {
	return new Promise((resolve, reject) => {
		cp.exec('which git', (err, stdout) => {
			if (err) {
				reject(new Error(UNABLE_TO_FIND_GIT_MSG));
				return;
			}

			const gitPath = stdout.trim();
			if (gitPath !== '/usr/bin/git') {
				getGitExecutable(gitPath).then(resolve, reject);
				return;
			}

			// Check if XCode is installed (required for /usr/bin/git)
			cp.exec('xcode-select -p', (err: cp.ExecException | null) => {
				if (err && err.code === 2) {
					reject(new Error('Git is not installed. Please install XCode Command Line Tools.'));
				} else {
					getGitExecutable(gitPath).then(resolve, reject);
				}
			});
		});
	});
}

/**
 * Find Git on Windows.
 */
async function findGitOnWin32(): Promise<GitExecutable> {
	const attempts = [
		() => findSystemGitWin32(process.env['ProgramW6432']),
		() => findSystemGitWin32(process.env['ProgramFiles(x86)']),
		() => findSystemGitWin32(process.env['ProgramFiles']),
			() =>
				process.env['LocalAppData']
					? findSystemGitWin32(path.join(process.env['LocalAppData'], 'Programs'))
					: Promise.reject(new Error('LocalAppData is not set')),
		() => findGitWin32InPath(),
	];

	for (const attempt of attempts) {
		try {
			return await attempt();
		} catch {
			// Continue to next attempt
		}
	}

	throw new Error(UNABLE_TO_FIND_GIT_MSG);
}

function findSystemGitWin32(basePath?: string): Promise<GitExecutable> {
	if (!basePath) {
		return Promise.reject(new Error('No base path'));
	}
	return getGitExecutable(path.join(basePath, 'Git', 'cmd', 'git.exe'));
}

async function findGitWin32InPath(): Promise<GitExecutable> {
	const pathEnv = process.env['PATH'] || '';
	const dirs = pathEnv.split(';');
	dirs.unshift(process.cwd());

	for (const dir of dirs) {
		const gitPath = path.join(dir, 'git.exe');
		if (await isExecutable(gitPath)) {
			try {
				return await getGitExecutable(gitPath);
			} catch {
				// Continue to next
			}
		}
	}

	return Promise.reject(new Error('Git not found in PATH'));
}

/**
 * Check if a path is an executable.
 */
function isExecutable(p: string): Promise<boolean> {
	return new Promise((resolve) => {
		fs.stat(p, (err, stat) => {
			resolve(!err && (stat.isFile() || stat.isSymbolicLink()));
		});
	});
}

/**
 * Get Git executable info from a path.
 */
export function getGitExecutable(gitPath: string): Promise<GitExecutable> {
	return new Promise((resolve, reject) => {
		resolveSpawnOutput(cp.spawn(gitPath, ['--version']))
			.then(([status, stdout]) => {
				if (status.code === 0) {
					const version = stdout.toString().trim().replace(/^git version /, '');
					resolve({ path: gitPath, version });
				} else {
					reject(new Error(`Git executable at ${gitPath} returned non-zero exit code`));
				}
			})
			.catch(() => {
				reject(new Error(`Failed to execute git at ${gitPath}`));
			});
	});
}

/**
 * Resolve spawn output.
 */
function resolveSpawnOutput(cmd: cp.ChildProcess): Promise<
	[{ code: number; error: Error | null }, Buffer, string]
> {
	return Promise.all([
		new Promise<{ code: number; error: Error | null }>((resolve) => {
			let resolved = false;
			cmd.on('error', (error) => {
				if (resolved) return;
				resolve({ code: -1, error });
				resolved = true;
			});
			cmd.on('exit', (code) => {
				if (resolved) return;
				resolve({ code: code ?? -1, error: null });
				resolved = true;
			});
		}),
		new Promise<Buffer>((resolve) => {
			const buffers: Buffer[] = [];
			cmd.stdout?.on('data', (b: Buffer) => buffers.push(b));
			cmd.stdout?.on('close', () => { resolve(Buffer.concat(buffers)); });
		}),
			new Promise<string>((resolve) => {
				let stderr = '';
				cmd.stderr?.on('data', (d: Buffer | string) => {
					stderr += Buffer.isBuffer(d) ? d.toString('utf8') : d;
				});
				cmd.stderr?.on('close', () => { resolve(stderr); });
			}),
	]);
}

// ==================== Version Handling ====================

interface ParsedVersion {
	major: number;
	minor: number;
	patch: number;
}

/**
 * Parse a version number from a string.
 */
function parseVersion(version: string): ParsedVersion | null {
	const match = version.trim().match(/^[0-9]+(\.[0-9]+|)(\.[0-9]+|)/);
	if (!match) {
		return null;
	}

	const comps = match[0].split('.');
	return {
		major: parseInt(comps[0] ?? '0', 10),
		minor: comps.length > 1 ? parseInt(comps[1] ?? '0', 10) : 0,
		patch: comps.length > 2 ? parseInt(comps[2] ?? '0', 10) : 0,
	};
}

/**
 * Check whether a version is at least a required version.
 */
export function doesVersionMeetRequirement(
	version: string,
	requiredVersion: GitVersionRequirement
): boolean {
	const v1 = parseVersion(version);
	const v2 = parseVersion(requiredVersion);

	if (!v1 || !v2) {
		return true; // Unable to parse, assume compatible
	}

	if (v1.major !== v2.major) {
		return v1.major > v2.major;
	}
	if (v1.minor !== v2.minor) {
		return v1.minor > v2.minor;
	}
	return v1.patch >= v2.patch;
}

/**
 * Construct a message explaining version incompatibility.
 */
export function constructIncompatibleGitVersionMessage(
	executable: GitExecutable,
	version: GitVersionRequirement,
	feature?: string
): string {
	return (
		`A newer version of Git (>= ${version}) is required for ` +
		(feature ? feature : 'this feature') +
		`. Git ${executable.version} is currently installed. ` +
		`Please install a newer version of Git to use this feature.`
	);
}
