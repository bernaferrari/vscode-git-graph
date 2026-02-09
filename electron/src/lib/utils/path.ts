/**
 * Path Utilities
 * Ported from git-graph/src/utils.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const FS_REGEX = /\\/g;

/**
 * Get the normalized path of a string.
 */
export function normalizePath(str: string): string {
	return str.replace(FS_REGEX, '/');
}

/**
 * Get the path with a trailing slash.
 */
export function pathWithTrailingSlash(p: string): string {
	return p.endsWith('/') ? p : p + '/';
}

/**
 * Get the canonical absolute path (resolves symlinks).
 */
export function realpath(p: string, native: boolean = false): Promise<string> {
	return new Promise((resolve) => {
		const realpathFn = native ? fs.realpath.native : fs.realpath;
		realpathFn(p, (err, resolvedPath) => {
			resolve(err !== null ? p : normalizePath(resolvedPath));
		});
	});
}

/**
 * Checks whether a file exists, and the user has access to read it.
 */
export function doesFileExist(p: string): Promise<boolean> {
	return new Promise((resolve) => {
		fs.access(p, fs.constants.R_OK, (err) => resolve(err === null));
	});
}

/**
 * Checks whether a directory exists.
 */
export function doesDirectoryExist(p: string): Promise<boolean> {
	return new Promise((resolve) => {
		fs.stat(p, (err, stats) => {
			resolve(err === null && stats.isDirectory());
		});
	});
}

/**
 * Get a short name for a repository from its path.
 */
export function getRepoName(p: string): string {
	const firstSep = p.indexOf('/');
	if (firstSep === p.length - 1 || firstSep === -1) {
		return p;
	}
	const normalized = p.endsWith('/') ? p.substring(0, p.length - 1) : p;
	return normalized.substring(normalized.lastIndexOf('/') + 1);
}

/**
 * Check if a path is inside another path.
 */
export function isPathInside(childPath: string, parentPath: string): boolean {
	const normalizedChild = normalizePath(childPath);
	const normalizedParent = pathWithTrailingSlash(normalizePath(parentPath));
	return normalizedChild.startsWith(normalizedParent);
}

/**
 * Get the relative path from one absolute path to another.
 */
export function getRelativePath(from: string, to: string): string {
	return path.relative(from, to).replace(FS_REGEX, '/');
}

/**
 * Join path segments.
 */
export function joinPaths(...segments: string[]): string {
	return path.join(...segments).replace(FS_REGEX, '/');
}

/**
 * Get the directory name of a path.
 */
export function getDirectoryName(p: string): string {
	return path.dirname(p).replace(FS_REGEX, '/');
}

/**
 * Get the file name from a path.
 */
export function getFileName(p: string): string {
	return path.basename(p);
}

/**
 * Get the file extension from a path.
 */
export function getFileExtension(p: string): string {
	return path.extname(p);
}
