/**
 * Git tRPC Router
 * Exposes Git operations as tRPC procedures
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

import { appStore, instanceStore } from '@/app/backend/store';
import { readSecretValue, setSecretValue } from '@/app/backend/store/secret';

import { parseWorktreePorcelainRecords } from './worktree';
import { findGit } from '../../../services/gitExecutable';
import { GitService, type DiffNameStatusRecord, type DiffNumStatRecord } from '../../../services/gitService';
import {
    addPullRequestComment as addRemotePullRequestComment,
    addPullRequestInlineComment as addRemotePullRequestInlineComment,
    closePullRequest as closeRemotePullRequest,
    createPullRequest as createRemotePullRequest,
    getPullRequest as getRemotePullRequest,
    getPullRequestReviewState as getRemotePullRequestReviewState,
    listPullRequestComments as listRemotePullRequestComments,
    listPullRequests as listRemotePullRequests,
    mergePullRequest as mergeRemotePullRequest,
    parseRemoteUrl as parsePullRequestRemoteUrl,
    type ProviderAuthConfig,
    type PullRequestRecord,
    type PullRequestProvider,
} from '../../../services/pullRequest';
import { router, publicProcedure } from '../../init';

// Singleton Git service instance
let gitService: GitService | null = null;
const providerGithubTokenSecretKey = 'providerAuth.githubToken';
const providerGitlabTokenSecretKey = 'providerAuth.gitlabToken';
const providerBitbucketTokenSecretKey = 'providerAuth.bitbucketToken';
const providerAzureTokenSecretKey = 'providerAuth.azureToken';

function readStoredString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function hydrateProviderAuthConfig(): ProviderAuthConfig {
    const current = appStore.get('providerAuth') as Partial<Record<string, unknown>>;
    const githubToken = readSecretValue(providerGithubTokenSecretKey);
    const gitlabToken = readSecretValue(providerGitlabTokenSecretKey);
    const bitbucketToken = readSecretValue(providerBitbucketTokenSecretKey);
    const azureToken = readSecretValue(providerAzureTokenSecretKey);

    const currentGithubToken = readStoredString(current.githubToken);
    const currentGitlabToken = readStoredString(current.gitlabToken);
    const currentBitbucketToken = readStoredString(current.bitbucketToken);
    const currentAzureToken = readStoredString(current.azureToken);
    const currentBitbucketUsername = readStoredString(current.bitbucketUsername);

    if (currentGithubToken || currentGitlabToken || currentBitbucketToken || currentAzureToken) {
        setSecretValue(providerGithubTokenSecretKey, currentGithubToken);
        setSecretValue(providerGitlabTokenSecretKey, currentGitlabToken);
        setSecretValue(providerBitbucketTokenSecretKey, currentBitbucketToken);
        setSecretValue(providerAzureTokenSecretKey, currentAzureToken);
        appStore.set('providerAuth', {
            githubToken: '',
            gitlabToken: '',
            bitbucketToken: '',
            bitbucketUsername: currentBitbucketUsername,
            azureToken: '',
        });
    }

    const auth: ProviderAuthConfig = {};
    const normalizedGithubToken = githubToken || currentGithubToken;
    const normalizedGitlabToken = gitlabToken || currentGitlabToken;
    const normalizedBitbucketToken = bitbucketToken || currentBitbucketToken;
    const normalizedAzureToken = azureToken || currentAzureToken;

    if (normalizedGithubToken) auth.githubToken = normalizedGithubToken;
    if (normalizedGitlabToken) auth.gitlabToken = normalizedGitlabToken;
    if (normalizedBitbucketToken) auth.bitbucketToken = normalizedBitbucketToken;
    if (currentBitbucketUsername) auth.bitbucketUsername = currentBitbucketUsername;
    if (normalizedAzureToken) auth.azureToken = normalizedAzureToken;

    return auth;
}

function persistProviderAuthConfig(auth: ProviderAuthConfig): void {
    setSecretValue(providerGithubTokenSecretKey, auth.githubToken ?? '');
    setSecretValue(providerGitlabTokenSecretKey, auth.gitlabToken ?? '');
    setSecretValue(providerBitbucketTokenSecretKey, auth.bitbucketToken ?? '');
    setSecretValue(providerAzureTokenSecretKey, auth.azureToken ?? '');

    appStore.set('providerAuth', {
        githubToken: '',
        gitlabToken: '',
        bitbucketToken: '',
        bitbucketUsername: auth.bitbucketUsername?.trim() ?? '',
        azureToken: '',
    });
}

function getGitService(): GitService {
    if (!gitService) {
        gitService = new GitService({
            dateType: 'author',
            showSignatureStatus: false,
            useMailmap: false,
            fileEncoding: 'utf8',
            signCommits: false,
            signTags: false,
            showUncommittedChanges: true,
        });
    }
    return gitService;
}

// Initialize Git on startup
let gitInitialized = false;
async function ensureGitInitialized(): Promise<string | null> {
    if (gitInitialized && gitService?.isGitAvailable()) {
        return null;
    }

    try {
        const executable = await findGit();
        getGitService().setGitExecutable(executable);
        gitInitialized = true;
        return null;
    } catch (error) {
        return error instanceof Error ? error.message : 'Failed to find Git executable';
    }
}

async function runRebaseCommandWithOptionalTodos(args: string[], repo: string, todos?: string): Promise<string | null> {
    const trimmedTodos = todos?.trim();
    const gitService = getGitService();

    if (trimmedTodos) {
        const validationError = validateRebaseTodoText(trimmedTodos);
        if (validationError) {
            return validationError;
        }
        return gitService.runGitCommandWithInteractiveTodo(args, repo, trimmedTodos);
    }

    return gitService.runGitCommand(args, repo);
}

async function commitHasParent(repo: string, commitHash: string): Promise<boolean> {
    const error = await getGitService().runGitCommand(['cat-file', '-e', `${commitHash}^`], repo);
    return !error;
}

async function getCommitSubject(repo: string, commitHash: string): Promise<string> {
    const output = await getGitService().runGitCommandWithOutput(['show', '-s', '--format=%s', commitHash], repo);
    return (output ?? '').trim().replace(/\s+/g, ' ');
}

async function buildSelectedCommitRebaseTodo(
    repo: string,
    commitHashes: string[],
    selectedAction: 'drop' | 'fixup'
): Promise<{ args: string[]; todos: string; error: string | null }> {
    const selected = new Set(commitHashes.map((hash) => hash.trim()).filter(Boolean));
    if (selected.size === 0) {
        return { args: [], todos: '', error: 'Select at least one commit.' };
    }

    const revListOutput = await getGitService().runGitCommandWithOutput(['rev-list', '--reverse', 'HEAD'], repo);
    const headCommits = (revListOutput ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
    const selectedIndices = headCommits
        .map((hash, index) => (selected.has(hash) ? index : -1))
        .filter((index) => index >= 0);

    if (selectedIndices.length !== selected.size) {
        return { args: [], todos: '', error: 'All selected commits must be reachable from HEAD.' };
    }

    const firstSelectedIndex = selectedIndices[0] ?? -1;
    const selectedCommitsAreContiguous =
        selectedIndices.every((index, offset) => index === firstSelectedIndex + offset);

    if (selectedAction === 'fixup' && !selectedCommitsAreContiguous) {
        return { args: [], todos: '', error: 'Select contiguous commits to squash them together.' };
    }

    const oldestSelected = headCommits[firstSelectedIndex];
    if (!oldestSelected) {
        return { args: [], todos: '', error: 'Unable to resolve selected commits.' };
    }

    const todoCommits = headCommits.slice(firstSelectedIndex);
    const todoLines = await Promise.all(
        todoCommits.map(async (hash) => {
            const subject = await getCommitSubject(repo, hash);
            if (selected.has(hash)) {
                if (selectedAction === 'drop') {
                    return `drop ${hash} ${subject}`;
                }
                return hash === oldestSelected ? `pick ${hash} ${subject}` : `fixup ${hash} ${subject}`;
            }
            return `pick ${hash} ${subject}`;
        })
    );

    const hasParent = await commitHasParent(repo, oldestSelected);
    const args = hasParent ? ['rebase', '-i', `${oldestSelected}^`] : ['rebase', '-i', '--root'];

    return { args, todos: todoLines.join('\n'), error: null };
}

async function getGitDir(repo: string): Promise<string | null> {
    const output = await getGitService().runGitCommandWithOutput(['rev-parse', '--git-dir'], repo);
    const gitDir = output?.trim();
    if (!gitDir) {
        return null;
    }

    return path.isAbsolute(gitDir) ? gitDir : path.resolve(repo, gitDir);
}

function resolveRepoPath(repo: string, targetPath: string): string {
    const repositoryRoot = path.resolve(repo);
    const normalizedPath = targetPath.replace(/\\/g, '/');
    const fullPath = path.resolve(repositoryRoot, normalizedPath);

    if (fullPath !== repositoryRoot && !fullPath.startsWith(`${repositoryRoot}${path.sep}`)) {
        throw new Error('Invalid file path');
    }

    return fullPath;
}

function validateGitPath(inputPath: string): string {
    const normalized = inputPath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    if (!normalized || normalized === '.' || path.isAbsolute(normalized) || segments.includes('..')) {
        throw new Error('Invalid file path');
    }
    return normalized;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

interface SshPublicKeyInfo {
    path: string;
    fileName: string;
    algorithm: string;
    comment: string | null;
    fingerprint: string | null;
}

interface SigningStatusSnapshot {
    enabled: boolean;
    method: 'gpg' | 'ssh';
    key: string | null;
    gpgProgram: string | null;
    gpgKeys: Array<{ id: string; userId: string }>;
    sshKeys: SshPublicKeyInfo[];
    allowedSignersFile: string | null;
}

interface SigningConfigUpdate {
    repo: string;
    enabled: boolean;
    method?: 'gpg' | 'ssh';
    key?: string;
    gpgProgram?: string;
    allowedSignersFile?: string;
    global?: boolean;
}

function withDefinedProps<T extends object>(value: T): Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<{
        [K in keyof T]: Exclude<T[K], undefined>;
    }>;
}

function parseSshPublicKey(rawContent: string): { algorithm: string; comment: string | null } | null {
    const trimmed = rawContent.trim();
    if (!trimmed) {
        return null;
    }

    const [algorithm, keyData, ...commentParts] = trimmed.split(/\s+/);
    if (!algorithm || !keyData) {
        return null;
    }

    return {
        algorithm,
        comment: commentParts.length > 0 ? commentParts.join(' ') : null,
    };
}

async function readSshKeyFingerprint(keyPath: string): Promise<string | null> {
    try {
        const { execFileSync } = await import('child_process');
        const output = execFileSync('ssh-keygen', ['-lf', keyPath], { encoding: 'utf-8' }).trim();
        const match = output.match(/^\d+\s+(\S+)/);
        return match?.[1] ?? null;
    } catch {
        return null;
    }
}

async function discoverSshPublicKeys(selectedSigningKeyPath: string | null): Promise<SshPublicKeyInfo[]> {
    const sshDir = path.join(os.homedir(), '.ssh');
    const keys: SshPublicKeyInfo[] = [];

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const entries = await fs.readdir(sshDir, { withFileTypes: true });
        const pubEntries = entries
            .filter((entry) => entry.isFile() && entry.name.endsWith('.pub'))
            .sort((a, b) => a.name.localeCompare(b.name));

        const discovered = await Promise.all(
            pubEntries.map(async (entry): Promise<SshPublicKeyInfo | null> => {
                const keyPath = path.join(sshDir, entry.name);

                try {
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    const content = await fs.readFile(keyPath, 'utf-8');
                    const parsed = parseSshPublicKey(content);
                    if (!parsed) {
                        return null;
                    }

                    return {
                        path: keyPath,
                        fileName: entry.name,
                        algorithm: parsed.algorithm,
                        comment: parsed.comment,
                        fingerprint: await readSshKeyFingerprint(keyPath),
                    };
                } catch {
                    // Keep discovering other keys if one file is unreadable/corrupt.
                    return null;
                }
            })
        );

        keys.push(...discovered.filter((key): key is SshPublicKeyInfo => key !== null));
    } catch {
        // SSH directory not available.
    }

    if (selectedSigningKeyPath && !keys.some((key) => key.path === selectedSigningKeyPath)) {
        keys.unshift({
            path: selectedSigningKeyPath,
            fileName: path.basename(selectedSigningKeyPath),
            algorithm: 'custom',
            comment: 'Configured signing key',
            fingerprint: await readSshKeyFingerprint(selectedSigningKeyPath),
        });
    }

    return keys;
}

async function listGpgSecretKeys(): Promise<Array<{ id: string; userId: string }>> {
    const gpgKeys: Array<{ id: string; userId: string }> = [];
    try {
        const { execFileSync } = await import('child_process');
        const output = execFileSync('gpg', ['--list-secret-keys', '--keyid-format=LONG'], {
            encoding: 'utf-8',
        });

        const keyRegex = /sec\s+\w+\/(\w+)\s+\d{4}-\d{2}-\d{2}\s+[^\n]+\n\s+([^\n]+)/g;
        let match: RegExpExecArray | null;
        while ((match = keyRegex.exec(output)) !== null) {
            gpgKeys.push({
                id: match[1] ?? '',
                userId: match[2]?.trim() ?? '',
            });
        }
    } catch {
        // GPG is not available on this machine.
    }

    return gpgKeys;
}

async function readSigningStatusSnapshot(
    repo: string,
    options?: { includeGpgKeys?: boolean }
): Promise<SigningStatusSnapshot> {
    const gitService = getGitService();
    const includeGpgKeys = options?.includeGpgKeys ?? true;
    const [enabledRaw, methodRaw, keyRaw, gpgProgramRaw, allowedSignersFileRaw, gpgKeys] = await Promise.all([
        gitService.runGitCommandWithOutput(['config', '--get', 'commit.gpgsign'], repo),
        gitService.runGitCommandWithOutput(['config', '--get', 'gpg.format'], repo),
        gitService.runGitCommandWithOutput(['config', '--get', 'user.signingkey'], repo),
        gitService.runGitCommandWithOutput(['config', '--get', 'gpg.program'], repo),
        gitService.runGitCommandWithOutput(['config', '--get', 'gpg.ssh.allowedSignersFile'], repo),
        includeGpgKeys ? listGpgSecretKeys() : Promise.resolve([]),
    ]);

    const key = keyRaw?.trim() ?? null;
    const sshKeys = await discoverSshPublicKeys(key);

    return {
        enabled: enabledRaw?.trim() === 'true',
        method: methodRaw?.trim() === 'ssh' ? 'ssh' : 'gpg',
        key,
        gpgProgram: gpgProgramRaw?.trim() ?? null,
        gpgKeys,
        sshKeys,
        allowedSignersFile: allowedSignersFileRaw?.trim() ?? null,
    };
}

async function setOrUnsetGitConfig(
    repo: string,
    scope: '--global' | '--local',
    configKey: string,
    value: string | undefined
): Promise<string | null> {
    const gitService = getGitService();
    const trimmed = value?.trim();

    if (trimmed) {
        return gitService.runGitCommand(['config', scope, '--replace-all', configKey, trimmed], repo);
    }

    const unsetError = await gitService.runGitCommand(['config', scope, '--unset-all', configKey], repo);
    if (!unsetError) {
        return null;
    }

    const normalized = unsetError.toLowerCase();
    if (normalized.includes('no such section or key') || normalized.includes('no such key')) {
        return null;
    }

    return unsetError;
}

async function applySigningConfig(update: SigningConfigUpdate): Promise<string | null> {
    const gitService = getGitService();
    const scope: '--global' | '--local' = update.global ? '--global' : '--local';

    let error = await gitService.runGitCommand(
        ['config', scope, 'commit.gpgsign', update.enabled.toString()],
        update.repo
    );
    if (error || !update.enabled) {
        return error;
    }

    const effectiveMethod =
        update.method ??
        ((await gitService.runGitCommandWithOutput(['config', '--get', 'gpg.format'], update.repo))?.trim() === 'ssh'
            ? 'ssh'
            : 'gpg');

    error = await gitService.runGitCommand(['config', scope, 'gpg.format', effectiveMethod], update.repo);
    if (error) {
        return error;
    }

    error = await setOrUnsetGitConfig(update.repo, scope, 'user.signingkey', update.key);
    if (error) {
        return error;
    }

    error = await setOrUnsetGitConfig(
        update.repo,
        scope,
        'gpg.program',
        effectiveMethod === 'gpg' ? update.gpgProgram : undefined
    );
    if (error) {
        return error;
    }

    return setOrUnsetGitConfig(
        update.repo,
        scope,
        'gpg.ssh.allowedSignersFile',
        effectiveMethod === 'ssh' ? update.allowedSignersFile : undefined
    );
}

function parseConflictedFilesFromStatusOutput(statusOutput: string | null): string[] {
    if (!statusOutput) {
        return [];
    }

    const conflicted: string[] = [];
    for (const line of statusOutput.split('\n').filter(Boolean)) {
        const index = line[0];
        const workTree = line[1];
        if (
            index === 'U' ||
            workTree === 'U' ||
            (index === 'A' && workTree === 'A') ||
            (index === 'D' && workTree === 'D')
        ) {
            conflicted.push(line.slice(3));
        }
    }
    return conflicted;
}

function parseLfsTrackPatterns(trackOutput: string | null): string[] {
    if (!trackOutput) {
        return [];
    }

    const patterns: string[] = [];
    for (const rawLine of trackOutput.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.toLowerCase().startsWith('listing ')) {
            continue;
        }

        const match = line.match(/^"?(.*?)"?\s+\(.+\)$/);
        const pattern = (match?.[1] ?? line).trim().replace(/^"|"$/g, '');
        if (pattern) {
            patterns.push(pattern);
        }
    }

    return patterns;
}

function parseByteSizeToken(value: string): number | null {
    const normalized = value.replace(/,/g, '').trim();
    // eslint-disable-next-line security/detect-unsafe-regex
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*([kmgtp]?i?b?)?$/i);
    if (!match?.[1]) {
        return null;
    }

    const amount = Number.parseFloat(match[1]);
    if (!Number.isFinite(amount)) {
        return null;
    }

    const unit = (match[2] ?? 'b').toLowerCase();
    const multipliers: Record<string, number> = {
        b: 1,
        kb: 1024,
        kib: 1024,
        mb: 1024 ** 2,
        mib: 1024 ** 2,
        gb: 1024 ** 3,
        gib: 1024 ** 3,
        tb: 1024 ** 4,
        tib: 1024 ** 4,
        pb: 1024 ** 5,
        pib: 1024 ** 5,
    };
    const multiplier = multipliers[unit];
    if (!multiplier) {
        return null;
    }

    return Math.round(amount * multiplier);
}

function formatByteSize(value: number | null): string | null {
    if (value === null || !Number.isFinite(value) || value < 0) {
        return null;
    }

    if (value < 1024) {
        return `${String(value)} B`;
    }

    const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
    let size = value / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    const unit = units[unitIndex] ?? 'PB';
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function parseLfsTrackedFiles(lsFilesOutput: string | null): Array<{
    oid: string;
    path: string;
    sizeBytes: number | null;
    sizeLabel: string | null;
}> {
    if (!lsFilesOutput) {
        return [];
    }

    const files: Array<{
        oid: string;
        path: string;
        sizeBytes: number | null;
        sizeLabel: string | null;
    }> = [];

    for (const rawLine of lsFilesOutput.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;

        const oidMatch = line.match(/^([0-9a-f]{6,64})\s+/i);
        const oid = oidMatch?.[1] ?? '';

        const sizeMatch = line.match(/\(([^)]+)\)\s*$/);
        const sizeToken = sizeMatch?.[1]?.trim() ?? null;
        const sizeBytes = sizeToken ? parseByteSizeToken(sizeToken) : null;

        const pathWithPrefix = line
            .replace(/^([0-9a-f]{6,64})\s+[*-]\s+/i, '')
            .replace(/\s+\([^)]+\)\s*$/, '');
        const filePath = pathWithPrefix.trim();

        if (!filePath) continue;
        files.push({
            oid,
            path: filePath,
            sizeBytes,
            sizeLabel: sizeToken ?? formatByteSize(sizeBytes),
        });
    }

    return files;
}

const pullRequestProviderSchema = z.enum(['github', 'gitlab', 'bitbucket', 'azure']);

function getStoredProviderAuthConfig(): ProviderAuthConfig {
    return hydrateProviderAuthConfig();
}

function resolveGlobalGitConfigPath(): string {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME?.trim();
    if (xdgConfigHome) {
        return path.join(xdgConfigHome, 'git', 'config');
    }
    return path.join(os.homedir(), '.gitconfig');
}

function mapCiStatusFromGitHub(state: string | null | undefined): 'success' | 'failure' | 'pending' | 'running' | 'cancelled' | 'unknown' {
    switch ((state ?? '').toLowerCase()) {
        case 'success':
            return 'success';
        case 'failure':
        case 'error':
            return 'failure';
        case 'pending':
            return 'pending';
        default:
            return 'unknown';
    }
}

function mapCiStatusFromGitLab(state: string | null | undefined): 'success' | 'failure' | 'pending' | 'running' | 'cancelled' | 'unknown' {
    switch ((state ?? '').toLowerCase()) {
        case 'success':
            return 'success';
        case 'failed':
            return 'failure';
        case 'running':
            return 'running';
        case 'pending':
            return 'pending';
        case 'canceled':
        case 'cancelled':
        case 'skipped':
        case 'manual':
            return 'cancelled';
        default:
            return 'unknown';
    }
}

function mapCiStatusFromBitbucket(state: string | null | undefined): 'success' | 'failure' | 'pending' | 'running' | 'cancelled' | 'unknown' {
    switch ((state ?? '').toLowerCase()) {
        case 'successful':
        case 'success':
            return 'success';
        case 'failed':
        case 'error':
            return 'failure';
        case 'inprogress':
        case 'running':
            return 'running';
        case 'pending':
            return 'pending';
        case 'stopped':
            return 'cancelled';
        default:
            return 'unknown';
    }
}

async function getPreferredRemoteUrlForPullRequests(repo: string): Promise<string | null> {
    const git = getGitService();

    const originRemote = await git.runGitCommandWithOutput(['config', '--get', 'remote.origin.url'], repo);
    const normalizedOrigin = originRemote?.trim();
    if (normalizedOrigin) {
        return normalizedOrigin;
    }

    const remotes = await git.getRemotes(repo);
    for (const remoteName of remotes) {
        const remoteUrl = await git.runGitCommandWithOutput(['config', '--get', `remote.${remoteName}.url`], repo);
        const normalized = remoteUrl?.trim();
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

type RebaseTodoAction =
    | 'pick'
    | 'reword'
    | 'edit'
    | 'squash'
    | 'fixup'
    | 'drop'
    | 'exec'
    | 'break'
    | 'label'
    | 'reset'
    | 'merge'
    | 'noop';

const REBASE_TODO_ACTIONS_WITH_HASH: ReadonlySet<string> = new Set([
    'pick',
    'reword',
    'edit',
    'squash',
    'fixup',
    'drop',
]);

const REBASE_TODO_ACTIONS_WITHOUT_HASH: ReadonlySet<string> = new Set([
    'exec',
    'break',
    'label',
    'reset',
    'merge',
    'noop',
]);

const HASH_LIKE = /^[0-9a-f]{7,40}$/i;

interface RebaseTodoItem {
    action: RebaseTodoAction;
    hash: string;
    message: string;
}

interface RepoHealthDiagnostic {
    id: string;
    label: string;
    description: string;
    status: 'pass' | 'warn' | 'fail';
    detail: string;
    metrics?: Record<string, number | string | boolean | null>;
}

function parsePorcelainStatus(output: string | null): {
    stagedCount: number;
    unstagedCount: number;
    conflictedCount: number;
    untrackedCount: number;
} {
    const counts = {
        stagedCount: 0,
        unstagedCount: 0,
        conflictedCount: 0,
        untrackedCount: 0,
    };
    for (const line of output?.split('\n') ?? []) {
        if (line.length < 2) continue;
        const x = line[0] ?? ' ';
        const y = line[1] ?? ' ';
        if (x === '?' && y === '?') {
            counts.untrackedCount += 1;
            continue;
        }
        if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
            counts.conflictedCount += 1;
            continue;
        }
        if (x !== ' ') counts.stagedCount += 1;
        if (y !== ' ') counts.unstagedCount += 1;
    }
    return counts;
}

function parseLargeTrackedFiles(output: string | null): Array<{ path: string; sizeBytes: number }> {
    return (output?.split('\n') ?? [])
        .map((line) => {
            const match = line.match(/^\S+\s+\S+\s+\S+\s+(\d+|-)\t(.+)$/);
            const rawSize = match?.[1];
            const filePath = match?.[2];
            if (!rawSize || rawSize === '-' || !filePath) {
                return null;
            }
            return { path: filePath, sizeBytes: Number(rawSize) };
        })
        .filter((entry): entry is { path: string; sizeBytes: number } => Boolean(entry))
        .sort((left, right) => right.sizeBytes - left.sizeBytes);
}

function parseBranchDates(output: string | null): Array<{ name: string; timestamp: number }> {
    return (output?.split('\n') ?? [])
        .map((line) => {
            const [name, rawTimestamp] = line.split('|');
            const timestamp = Number(rawTimestamp);
            if (!name || !Number.isFinite(timestamp)) {
                return null;
            }
            return { name, timestamp };
        })
        .filter((entry): entry is { name: string; timestamp: number } => Boolean(entry));
}

function parseAheadBehind(output: string | null): { ahead: number; behind: number } | null {
    const [behindRaw, aheadRaw] = output?.trim().split(/\s+/) ?? [];
    const ahead = Number(aheadRaw);
    const behind = Number(behindRaw);
    if (!Number.isFinite(ahead) || !Number.isFinite(behind)) {
        return null;
    }
    return { ahead, behind };
}

async function buildRepoHealthDiagnostics(repo: string): Promise<{
    checks: RepoHealthDiagnostic[];
    score: number;
    generatedAt: number;
}> {
    const git = getGitService();
    const statusOutput = await git.runGitCommandWithOutput(['status', '--porcelain=v1'], repo);
    const statusCounts = parsePorcelainStatus(statusOutput);
    const remoteOutput = await git.runGitCommandWithOutput(['remote', '-v'], repo);
    const head = (await git.runGitCommandWithOutput(['branch', '--show-current'], repo))?.trim() || null;
    const upstream = (await git.runGitCommandWithOutput(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], repo))?.trim() || null;
    const aheadBehind = upstream
        ? parseAheadBehind(await git.runGitCommandWithOutput(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], repo))
        : null;
    const largeFiles = parseLargeTrackedFiles(await git.runGitCommandWithOutput(['ls-tree', '-r', '-l', 'HEAD'], repo));
    const largeFileThreshold = 5 * 1024 * 1024;
    const oversizedFiles = largeFiles.filter((file) => file.sizeBytes >= largeFileThreshold).slice(0, 5);
    const staleThresholdSeconds = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
    const branchDates = parseBranchDates(
        await git.runGitCommandWithOutput(['for-each-ref', '--format=%(refname:short)|%(committerdate:unix)', 'refs/heads'], repo)
    );
    const staleBranches = branchDates
        .filter((branch) => branch.name !== head && branch.timestamp < staleThresholdSeconds)
        .sort((left, right) => left.timestamp - right.timestamp)
        .slice(0, 5);
    const mergedBranches = (await git.runGitCommandWithOutput(['branch', '--merged', 'HEAD', '--format=%(refname:short)'], repo))
        ?.split('\n')
        .map((branch) => branch.trim())
        .filter((branch) => branch && branch !== head && !['main', 'master', 'develop'].includes(branch))
        .slice(0, 8) ?? [];
    const lfsFiles = parseLfsTrackedFiles(await git.runGitCommandWithOutput(['lfs', 'ls-files', '--size'], repo));
    const submoduleOutput = await git.runGitCommandWithOutput(['submodule', 'status', '--recursive'], repo);
    const submoduleLines = submoduleOutput?.split('\n').filter((line) => line.trim().length > 0) ?? [];
    const fsckError = await git.runGitCommand(['fsck', '--no-progress'], repo);

    const checks: RepoHealthDiagnostic[] = [
        {
            id: 'working-tree',
            label: 'Working Directory',
            description: 'Detect staged, unstaged, untracked, and conflicted files.',
            status: statusCounts.conflictedCount > 0 ? 'fail' : statusCounts.stagedCount + statusCounts.unstagedCount + statusCounts.untrackedCount > 0 ? 'warn' : 'pass',
            detail:
                statusCounts.stagedCount + statusCounts.unstagedCount + statusCounts.untrackedCount + statusCounts.conflictedCount > 0
                    ? `${String(statusCounts.stagedCount)} staged, ${String(statusCounts.unstagedCount)} unstaged, ${String(statusCounts.untrackedCount)} untracked, ${String(statusCounts.conflictedCount)} conflicted`
                    : 'Clean working directory',
            metrics: statusCounts,
        },
        {
            id: 'remote',
            label: 'Remote Configuration',
            description: 'Check whether remotes and upstream tracking are configured.',
            status: remoteOutput?.trim() ? (upstream ? 'pass' : 'warn') : 'warn',
            detail: remoteOutput?.trim()
                ? upstream
                    ? `Tracking ${upstream}`
                    : 'Remotes exist, but current branch has no upstream'
                : 'No remotes configured',
            metrics: {
                hasRemote: Boolean(remoteOutput?.trim()),
                upstream,
                ahead: aheadBehind?.ahead ?? null,
                behind: aheadBehind?.behind ?? null,
            },
        },
        {
            id: 'remote-drift',
            label: 'Remote Drift',
            description: 'Compare the current branch to its upstream.',
            status: !upstream ? 'warn' : (aheadBehind?.behind ?? 0) > 0 ? 'warn' : 'pass',
            detail: !upstream
                ? 'No upstream configured'
                : `${String(aheadBehind?.ahead ?? 0)} ahead, ${String(aheadBehind?.behind ?? 0)} behind ${upstream}`,
            metrics: {
                ahead: aheadBehind?.ahead ?? null,
                behind: aheadBehind?.behind ?? null,
            },
        },
        {
            id: 'large-files',
            label: 'Large Tracked Files',
            description: 'Find large files committed directly to Git history.',
            status: oversizedFiles.length > 0 ? 'warn' : 'pass',
            detail:
                oversizedFiles.length > 0
	                    ? oversizedFiles.map((file) => `${file.path} (${formatByteSize(file.sizeBytes) ?? 'unknown size'})`).join(', ')
                    : 'No tracked files over 5 MB in HEAD',
            metrics: {
                thresholdBytes: largeFileThreshold,
                largeFileCount: oversizedFiles.length,
            },
        },
        {
            id: 'branch-hygiene',
            label: 'Branch Hygiene',
            description: 'Find stale and already-merged local branches.',
            status: staleBranches.length + mergedBranches.length > 0 ? 'warn' : 'pass',
            detail:
                staleBranches.length + mergedBranches.length > 0
                    ? `${String(staleBranches.length)} stale, ${String(mergedBranches.length)} merged: ${[...staleBranches.map((branch) => branch.name), ...mergedBranches].slice(0, 6).join(', ')}`
                    : 'No stale or merged local branches detected',
            metrics: {
                staleBranchCount: staleBranches.length,
                mergedBranchCount: mergedBranches.length,
            },
        },
        {
            id: 'lfs-submodules',
            label: 'LFS and Submodules',
            description: 'Summarize LFS and submodule footprint.',
            status: submoduleLines.some((line) => line.startsWith('-') || line.startsWith('+')) ? 'warn' : 'pass',
            detail: `${String(lfsFiles.length)} LFS file(s), ${String(submoduleLines.length)} submodule(s)`,
            metrics: {
                lfsFileCount: lfsFiles.length,
                submoduleCount: submoduleLines.length,
            },
        },
        {
            id: 'object-integrity',
            label: 'Object Integrity',
            description: 'Run git fsck to detect object database problems.',
            status: fsckError ? 'fail' : 'pass',
            detail: fsckError ? fsckError.slice(0, 240) : 'git fsck completed without errors',
        },
    ];

    const score = Math.round(
        checks.reduce((total, check) => total + (check.status === 'pass' ? 100 : check.status === 'warn' ? 55 : 0), 0) /
            checks.length
    );

    return { checks, score, generatedAt: Date.now() };
}

function validateRebaseTodoText(todos: string): string | null {
    const trimmed = todos.trim();
    if (!trimmed) return null;

    for (const [index, rawLine] of trimmed.split('\n').entries()) {
        const lineNumber = String(index + 1);
        const trimmedLine = rawLine.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }

        const [rawAction, ...restParts] = trimmedLine.split(/\s+/);
        if (!rawAction) {
            return `Invalid rebase todo at line ${lineNumber}: empty command`;
        }

        const action = rawAction.toLowerCase();
        const hash = restParts[0];

        if (REBASE_TODO_ACTIONS_WITH_HASH.has(action)) {
            if (!hash || !HASH_LIKE.test(hash)) {
                return `Invalid rebase todo at line ${lineNumber}: "${action}" requires a valid commit hash`;
            }
            continue;
        }

        if (REBASE_TODO_ACTIONS_WITHOUT_HASH.has(action)) {
            continue;
        }

        return `Invalid rebase todo at line ${lineNumber}: unknown action "${rawAction}"`;
    }

    return null;
}

function parseRebaseTodoLine(line: string): RebaseTodoItem | null {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
        return null;
    }

    const actionWithCommitMatch = trimmedLine.match(
        // eslint-disable-next-line security/detect-unsafe-regex
        /^(pick|reword|edit|squash|fixup|drop)\s+([0-9a-f]{7,40})(?:\s+(.*))?$/i
    );
    if (actionWithCommitMatch) {
        const action = (actionWithCommitMatch[1] ?? '').toLowerCase() as RebaseTodoAction;
        const hash = (actionWithCommitMatch[2] ?? '').toLowerCase();
        return {
            action,
            hash,
            message: actionWithCommitMatch[3]?.trim() ?? '',
        };
    }

    const actionNoCommitMatch = trimmedLine.match(/^(exec|break)\s*(.*)$/i);
    if (actionNoCommitMatch) {
        const action = (actionNoCommitMatch[1] ?? '').toLowerCase() as RebaseTodoAction;
        return {
            action,
            hash: '',
            message: actionNoCommitMatch[2]?.trim() ?? '',
        };
    }

    const actionWithOptionalHashMatch = trimmedLine.match(/^(label|reset|merge|noop)\s+(.*)$/i);
    if (actionWithOptionalHashMatch) {
        const action = (actionWithOptionalHashMatch[1] ?? 'noop').toLowerCase() as RebaseTodoAction;
        const body = actionWithOptionalHashMatch[2] ?? '';
        if (!body) {
            return {
                action,
                hash: '',
                message: '',
            };
        }

        // eslint-disable-next-line security/detect-unsafe-regex
        const hashMatch = body.match(/^([0-9a-f]{7,40})(?:\s+(.*))?$/i);
        if (hashMatch) {
            const hash = (hashMatch[1] ?? '').toLowerCase();
            if (!hash) {
                return null;
            }
            return {
                action,
                hash,
                message: hashMatch[2]?.trim() ?? '',
            };
        }

        return {
            action,
            hash: '',
            message: body.trim(),
        };
    }

    const actionOnlyMatch = trimmedLine.match(/^(label|reset|merge|noop)\s*$/i);
    if (actionOnlyMatch) {
        const action = (actionOnlyMatch[1] ?? 'noop').toLowerCase() as RebaseTodoAction;
        return {
            action,
            hash: '',
            message: '',
        };
    }

    return null;
}

async function readRebaseTodo(
    gitDir: string
): Promise<{ source: 'rebase-merge' | 'rebase-apply'; rawTodo: string; todos: RebaseTodoItem[] } | null> {
    const rebaseTodoCandidates: Array<{ source: 'rebase-merge' | 'rebase-apply'; path: string }> = [
        { source: 'rebase-merge', path: path.join(gitDir, 'rebase-merge', 'git-rebase-todo') },
        { source: 'rebase-apply', path: path.join(gitDir, 'rebase-apply', 'git-rebase-todo') },
    ];

    for (const candidate of rebaseTodoCandidates) {
        if (!(await fileExists(candidate.path))) continue;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const rawTodo = await fs.readFile(candidate.path, 'utf8');
        const todos = rawTodo
            .split('\n')
            .map((line) => parseRebaseTodoLine(line))
            .filter((entry): entry is RebaseTodoItem => Boolean(entry));

        return {
            source: candidate.source,
            rawTodo,
            todos,
        };
    }

    return null;
}

function normalizeBranchRef(branchRef: string | null): string | null {
    if (!branchRef) return null;
    if (branchRef.startsWith('refs/heads/')) {
        return branchRef.slice('refs/heads/'.length);
    }
    return branchRef;
}

async function getWorktreeDirtyCount(worktreePath: string): Promise<number> {
    try {
        const status = await getGitService().runGitCommandWithOutput(['status', '--porcelain'], worktreePath);
        return (status ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean).length;
    } catch {
        return 0;
    }
}

async function getWorktreeLastCommitAt(worktreePath: string): Promise<number | null> {
    try {
        const output = await getGitService().runGitCommandWithOutput(['log', '-1', '--format=%ct'], worktreePath);
        const timestamp = Number.parseInt((output ?? '').trim(), 10);
        if (!Number.isFinite(timestamp) || timestamp <= 0) {
            return null;
        }
        return timestamp * 1000;
    } catch {
        return null;
    }
}

async function getWorktreeUpstream(branch: string, repo: string): Promise<string | null> {
    try {
        const upstream = await getGitService().runGitCommandWithOutput(
            ['for-each-ref', '--format=%(upstream:short)', `refs/heads/${branch}`],
            repo
        );
        return upstream?.trim() || null;
    } catch {
        return null;
    }
}

async function getWorktreeAheadBehind(
    branch: string,
    upstream: string | null,
    repo: string
): Promise<{ ahead: number; behind: number }> {
    if (!upstream) {
        return { ahead: 0, behind: 0 };
    }

    try {
        const output = await getGitService().runGitCommandWithOutput(
            ['rev-list', '--left-right', '--count', `${branch}...${upstream}`],
            repo
        );
        const match = output?.trim().match(/^(\d+)\s+(\d+)$/);
        if (!match?.[1] || !match[2]) {
            return { ahead: 0, behind: 0 };
        }

        return {
            ahead: Number.parseInt(match[1], 10),
            behind: Number.parseInt(match[2], 10),
        };
    } catch {
        return { ahead: 0, behind: 0 };
    }
}

async function commandExists(command: string): Promise<boolean> {
    try {
        const { spawnSync } = await import('node:child_process');
        const checkCommand = process.platform === 'win32' ? 'where' : 'which';
        const result = spawnSync(checkCommand, [command], { stdio: 'ignore' });
        return result.status === 0;
    } catch {
        return false;
    }
}

async function runExecutable(
    command: string,
    args: string[],
    cwd: string
): Promise<{ stdout: string; stderr: string; code: number | null; error: string | null }> {
    const { spawn } = await import('node:child_process');

    return await new Promise((resolve) => {
        const child = spawn(command, args, { cwd });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                code,
                error: code === 0 ? null : stderr.trim() || `${command} exited with code ${String(code ?? 'unknown')}`,
            });
        });

        child.on('error', (error) => {
            resolve({
                stdout,
                stderr,
                code: null,
                error: error.message,
            });
        });
    });
}

const workflowTriggerSchema = z.enum(['manual', 'onBranchChange', 'onCommit', 'onPush']);
const workflowStepTypeSchema = z.enum([
    'checkout',
    'fetch',
    'createBranch',
    'merge',
    'rebase',
    'push',
    'openPR',
    'runHook',
    'notify',
]);

const workflowStepSchema = z.object({
    id: z.string().min(1),
    type: workflowStepTypeSchema,
    params: z.record(z.string(), z.unknown()).default({}),
});

const workflowGuardSchema = z.object({
    type: z.string().min(1),
    value: z.string().optional(),
});

const workflowInputSchema = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    required: z.boolean().default(false),
    defaultValue: z.string().optional(),
});

const workflowDefinitionSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    trigger: workflowTriggerSchema,
    steps: z.array(workflowStepSchema).min(1),
    inputs: z.array(workflowInputSchema).default([]),
    guards: z.array(workflowGuardSchema).default([]),
    onFailure: z.enum(['stop', 'continue', 'rollback']).default('stop'),
    updatedAt: z.number(),
    createdAt: z.number(),
});

type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
type WorkflowStep = z.infer<typeof workflowStepSchema>;

function getWorkflowDefinitions(): WorkflowDefinition[] {
    const raw = instanceStore.get('workflowDefinitions');
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw
        .map((entry) => workflowDefinitionSchema.safeParse(entry))
        .filter((result): result is { success: true; data: WorkflowDefinition } => result.success)
        .map((result) => result.data);
}

function setWorkflowDefinitions(definitions: WorkflowDefinition[]): void {
    instanceStore.set('workflowDefinitions', definitions);
}

function addWorkflowRun(run: {
    id: string;
    workflowId: string;
    startedAt: number;
    finishedAt: number | null;
    status: 'running' | 'success' | 'failed';
    steps: Array<{ id: string; type: string; status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'; message?: string }>;
    error?: string;
}): void {
    const existing = instanceStore.get('workflowRuns');
    const nextRuns = Array.isArray(existing) ? [...existing, run] : [run];
    instanceStore.set('workflowRuns', nextRuns.slice(-500));
}

export const gitRouter = router({
    // ==================== System ====================

    /**
     * Check if Git is available and get version info.
     */
    status: publicProcedure.query(async () => {
        const initError = await ensureGitInitialized();
        if (initError) {
            return { available: false, error: initError, version: null, path: null };
        }

        const executable = getGitService().getGitExecutable();
        return {
            available: true,
            error: null,
            version: executable?.version ?? null,
            path: executable?.path ?? null,
            supportsGpgInfo: getGitService().supportsGpgInfo(),
        };
    }),

    // ==================== Repository ====================

    /**
     * Get the root of a repository for a given path.
     */
    repoRoot: publicProcedure.input(z.object({ path: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { root: null, error: initError };

        const root = await getGitService().getRepoRoot(input.path);
        return { root, error: null };
    }),

    /**
     * Run repository health diagnostics in the backend.
     */
    repoHealth: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) {
            return {
                checks: [],
                score: 0,
                generatedAt: Date.now(),
                error: initError,
            };
        }

        try {
            return {
                ...(await buildRepoHealthDiagnostics(input.repo)),
                error: null,
            };
        } catch (error) {
            return {
                checks: [],
                score: 0,
                generatedAt: Date.now(),
                error: error instanceof Error ? error.message : 'Unknown repository health error',
            };
        }
    }),

    /**
     * Get repository info (branches, remotes, stashes).
     */
    repoInfo: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                showRemoteBranches: z.boolean(),
                showStashes: z.boolean(),
                hideRemotes: z.array(z.string()),
                includePerf: z.boolean().optional(),
            })
        )
        .query(async ({ input }) => {
            const startedAt = Date.now();
            const initError = await ensureGitInitialized();
            if (initError) {
                return {
                    branches: [],
                    head: null,
                    remotes: [],
                    stashes: [],
                    tags: [],
                    error: initError,
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: 0,
                                  at: Date.now(),
                                  error: true,
                              },
                          }
                        : {}),
                };
            }

            try {
                const service = getGitService();
                const [branches, remotes, stashes, tags] = await Promise.all([
                    service.getBranches(input.repo, input.showRemoteBranches, input.hideRemotes),
                    service.getRemotes(input.repo),
                    input.showStashes ? service.getStashes(input.repo) : Promise.resolve([]),
                    service.getTags(input.repo),
                ]);

                return {
                    branches: branches.branches,
                    head: branches.head,
                    remotes,
                    stashes,
                    tags,
                    error: null,
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: Buffer.byteLength(
                                      JSON.stringify({
                                          branches: branches.branches,
                                          remotes,
                                          stashes,
                                          tags,
                                      }),
                                      'utf8'
                                  ),
                                  at: Date.now(),
                                  counts: {
                                      branches: branches.branches.length,
                                      remotes: remotes.length,
                                      stashes: stashes.length,
                                      tags: tags.length,
                                  },
                              },
                          }
                        : {}),
                };
            } catch (error) {
                return {
                    branches: [],
                    head: null,
                    remotes: [],
                    stashes: [],
                    tags: [],
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: 0,
                                  at: Date.now(),
                                  error: true,
                              },
                          }
                        : {}),
                };
            }
        }),

    /**
     * Get lightweight ref tips for commit decoration.
     */
    refs: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                showTags: z.boolean(),
                showRemoteBranches: z.boolean(),
                hideRemotes: z.array(z.string()),
                includePerf: z.boolean().optional(),
            })
        )
        .query(async ({ input }) => {
            const startedAt = Date.now();
            const initError = await ensureGitInitialized();
            if (initError) {
                return {
                    head: null,
                    heads: [],
                    tags: [],
                    remotes: [],
                    error: initError,
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: 0,
                                  at: Date.now(),
                                  error: true,
                              },
                          }
                        : {}),
                };
            }

            try {
                const refs = await getGitService().getRefs(input.repo, input.showRemoteBranches, input.hideRemotes);
                const responseTags = input.showTags ? refs.tags : [];
                return {
                    head: refs.head,
                    heads: refs.heads,
                    tags: responseTags,
                    remotes: refs.remotes,
                    error: null,
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: Buffer.byteLength(
                                      JSON.stringify({
                                          heads: refs.heads,
                                          tags: responseTags,
                                          remotes: refs.remotes,
                                      }),
                                      'utf8'
                                  ),
                                  at: Date.now(),
                                  counts: {
                                      heads: refs.heads.length,
                                      tags: responseTags.length,
                                      remotes: refs.remotes.length,
                                  },
                              },
                          }
                        : {}),
                };
            } catch (error) {
                return {
                    head: null,
                    heads: [],
                    tags: [],
                    remotes: [],
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: 0,
                                  at: Date.now(),
                                  error: true,
                              },
                          }
                        : {}),
                };
            }
        }),

    // ==================== Commits ====================

    /**
     * Get commit log.
     */
    commits: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                branches: z.array(z.string()).nullable(),
                maxCommits: z.number(),
                order: z.enum(['date', 'author-date', 'topo']),
                onlyFollowFirstParent: z.boolean(),
                showTags: z.boolean(),
                showRemoteBranches: z.boolean(),
                hideRemotes: z.array(z.string()),
                decorateRefs: z.boolean().optional(),
                includePerf: z.boolean().optional(),
                author: z.string().optional(),
                search: z.string().optional(),
                filePath: z.string().optional(),
                dateFrom: z.string().optional(),
                dateTo: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const startedAt = Date.now();
            const initError = await ensureGitInitialized();
            if (initError) {
                return {
                    commits: [],
                    head: null,
                    tags: [],
                    moreCommitsAvailable: false,
                    refsDeferred: false,
                    error: initError,
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: 0,
                                  at: Date.now(),
                                  error: true,
                              },
                          }
                        : {}),
                };
            }

            try {
                const service = getGitService();
                const decorateRefs = input.decorateRefs ?? true;
                const commits = await service.getLog(
                    input.repo,
                    input.branches,
                    input.maxCommits + 1,
                    input.order,
                    input.onlyFollowFirstParent,
                    {
                        ...(input.author ? { author: input.author } : {}),
                        ...(input.search ? { search: input.search } : {}),
                        ...(input.filePath ? { filePath: input.filePath } : {}),
                        ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
                        ...(input.dateTo ? { dateTo: input.dateTo } : {}),
                    }
                );

                const moreCommitsAvailable = commits.length === input.maxCommits + 1;
                if (moreCommitsAvailable) commits.pop();

                // Define annotated commit type
                interface AnnotatedCommit {
                    hash: string;
                    parents: string[];
                    author: string;
                    email: string;
                    date: number;
                    message: string;
                    heads: string[];
                    tags: string[];
                    remotes: string[];
                }

                // Annotate commits with refs
                const annotatedCommits: AnnotatedCommit[] = commits.map((c) => ({
                    ...c,
                    heads: [] as string[],
                    tags: [] as string[],
                    remotes: [] as string[],
                }));

                if (!decorateRefs) {
                    return {
                        commits: annotatedCommits,
                        head: null,
                        tags: [],
                        moreCommitsAvailable,
                        refsDeferred: true,
                        error: null,
                        ...(input.includePerf
                            ? {
                                  perf: {
                                      durationMs: Date.now() - startedAt,
                                      payloadBytes: Buffer.byteLength(
                                          JSON.stringify({
                                              commits: annotatedCommits,
                                          }),
                                          'utf8'
                                      ),
                                      at: Date.now(),
                                      counts: {
                                          commits: annotatedCommits.length,
                                      },
                                      refsDeferred: true,
                                  },
                              }
                            : {}),
                    };
                }

                const refs = await service.getRefs(input.repo, input.showRemoteBranches, input.hideRemotes);
                const commitLookup = new Map<string, number>(annotatedCommits.map((c, i) => [c.hash, i]));

                for (const head of refs.heads) {
                    const idx = commitLookup.get(head.hash);
                    if (idx !== undefined) {
                        const commit = annotatedCommits[idx];
                        if (commit) {
                            commit.heads.push(head.name);
                        }
                    }
                }

                if (input.showTags) {
                    for (const tag of refs.tags) {
                        const idx = commitLookup.get(tag.hash);
                        if (idx !== undefined) {
                            const commit = annotatedCommits[idx];
                            if (commit) {
                                commit.tags.push(tag.name);
                            }
                        }
                    }
                }

                return {
                    commits: annotatedCommits,
                    head: refs.head,
                    tags: refs.tags.map((t: { name: string }) => t.name),
                    moreCommitsAvailable,
                    refsDeferred: false,
                    error: null,
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: Buffer.byteLength(
                                      JSON.stringify({
                                          commits: annotatedCommits,
                                          head: refs.head,
                                          tags: refs.tags,
                                      }),
                                      'utf8'
                                  ),
                                  at: Date.now(),
                                  counts: {
                                      commits: annotatedCommits.length,
                                      heads: refs.heads.length,
                                      tags: refs.tags.length,
                                      remotes: refs.remotes.length,
                                  },
                                  refsDeferred: false,
                              },
                          }
                        : {}),
                };
            } catch (error) {
                return {
                    commits: [],
                    head: null,
                    tags: [],
                    moreCommitsAvailable: false,
                    refsDeferred: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    ...(input.includePerf
                        ? {
                              perf: {
                                  durationMs: Date.now() - startedAt,
                                  payloadBytes: 0,
                                  at: Date.now(),
                                  error: true,
                              },
                          }
                        : {}),
                };
            }
        }),

    /**
     * Get commit details.
     */
    commitDetails: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHash: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { details: null, error: initError };

            try {
                const service = getGitService();
                const [details, nameStatus, numStat] = await Promise.all([
                    service.getCommitDetails(input.repo, input.commitHash),
                    service.getDiffNameStatus(input.repo, `${input.commitHash}^`, input.commitHash),
                    service.getDiffNumStat(input.repo, `${input.commitHash}^`, input.commitHash),
                ]);

                // Combine name-status and numstat
                const fileChanges = nameStatus.map((ns: DiffNameStatusRecord) => {
                    const stats = numStat.find((n: DiffNumStatRecord) => n.filePath === ns.newFilePath);
                    return {
                        oldFilePath: ns.oldFilePath,
                        newFilePath: ns.newFilePath,
                        type: ns.type,
                        additions: stats?.additions ?? null,
                        deletions: stats?.deletions ?? null,
                    };
                });

                return {
                    details: { ...details, fileChanges },
                    error: null,
                };
            } catch (error) {
                return {
                    details: null,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    /**
     * Get commits from a starting commit through HEAD.
     */
    log: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                startHash: z.string(),
                maxCommits: z.number().min(1).max(500).default(50),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { commits: [], error: initError };

            try {
                const commits = await getGitService().getCommitsFrom(input.startHash, input.repo, input.maxCommits);
                return { commits, error: null };
            } catch (error) {
                return {
                    commits: [],
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    // ==================== Files ====================

    /**
     * Get file contents at a specific revision.
     */
    fileAtRevision: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHash: z.string(),
                filePath: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { content: null, error: initError };

            try {
                const content = await getGitService().getFileAtRevision(input.repo, input.commitHash, input.filePath);
                return { content, error: null };
            } catch (error) {
                return {
                    content: null,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    fileBinaryAtRevision: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHash: z.string(),
                filePath: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { contentBase64: null, error: initError };

            try {
                const contentBase64 = await getGitService().getFileBinaryAtRevision(
                    input.repo,
                    input.commitHash,
                    input.filePath
                );
                return { contentBase64, error: null };
            } catch (error) {
                return {
                    contentBase64: null,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    /**
     * Get diff between two revisions.
     */
    diff: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                fromHash: z.string(),
                toHash: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { fileChanges: [], error: initError };

            try {
                const service = getGitService();
                const [nameStatus, numStat] = await Promise.all([
                    service.getDiffNameStatus(input.repo, input.fromHash, input.toHash),
                    service.getDiffNumStat(input.repo, input.fromHash, input.toHash),
                ]);

                const fileChanges = nameStatus.map((ns: DiffNameStatusRecord) => {
                    const stats = numStat.find((n: DiffNumStatRecord) => n.filePath === ns.newFilePath);
                    return {
                        oldFilePath: ns.oldFilePath,
                        newFilePath: ns.newFilePath,
                        type: ns.type,
                        additions: stats?.additions ?? null,
                        deletions: stats?.deletions ?? null,
                    };
                });

                return { fileChanges, error: null };
            } catch (error) {
                return {
                    fileChanges: [],
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    // File-specific diff
    fileDiff: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHash: z.string(),
                filePath: z.string(),
                previousFilePath: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { diff: '', error: initError };

            try {
                const service = getGitService();
                const pathArgs =
                    input.previousFilePath && input.previousFilePath !== input.filePath
                        ? [input.previousFilePath, input.filePath]
                        : [input.filePath];
                const diff = await service.runGitCommandWithOutput(
                    [
                        'show',
                        '--format=',
                        '--no-ext-diff',
                        '--find-renames',
                        '--find-copies-harder',
                        input.commitHash,
                        '--',
                        ...pathArgs,
                    ],
                    input.repo
                );
                return { diff: diff ?? '', error: null };
            } catch (error) {
                return { diff: '', error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    rangeFileDiff: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                baseRef: z.string(),
                headRef: z.string(),
                filePath: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { diff: '', error: initError };

            try {
                const service = getGitService();
                const diff = await service.runGitCommandWithOutput(
                    ['diff', `${input.baseRef}...${input.headRef}`, '--', input.filePath],
                    input.repo
                );
                return { diff: diff ?? '', error: null };
            } catch (error) {
                return { diff: '', error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    // Working tree file diff (unstaged or staged)
    workingTreeFileDiff: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                filePath: z.string(),
                staged: z.boolean().optional().default(false),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { diff: '', error: initError };

            try {
                const service = getGitService();
                const args = input.staged
                    ? ['diff', '--cached', '--', input.filePath]
                    : ['diff', '--', input.filePath];
                const diff = await service.runGitCommandWithOutput(args, input.repo);
                return { diff: diff ?? '', error: null };
            } catch (error) {
                return { diff: '', error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    // ==================== Git Actions ====================

    /**
     * Checkout a branch.
     */
    checkout: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                ref: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            let error: string | null = null;
            if (input.ref.startsWith('remotes/')) {
                const remoteRef = input.ref.replace(/^remotes\//, '');
                const separator = remoteRef.indexOf('/');
                const localBranch = separator > -1 ? remoteRef.slice(separator + 1) : '';

                if (localBranch && localBranch !== 'HEAD') {
                    error = await getGitService().runGitCommand(['checkout', '--track', remoteRef], input.repo);
                    if (error && error.includes('already exists')) {
                        error = await getGitService().runGitCommand(['checkout', localBranch], input.repo);
                    }
                } else {
                    error = `Cannot checkout remote reference "${input.ref}".`;
                }
            } else {
                error = await getGitService().runGitCommand(['checkout', input.ref], input.repo);
            }

            return { error };
        }),

    /**
     * Create a branch.
     */
    createBranch: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                branchName: z.string(),
                commitHash: z.string(),
                checkout: z.boolean(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { errors: [initError] };

            const args = input.checkout
                ? ['checkout', '-b', input.branchName, input.commitHash]
                : ['branch', input.branchName, input.commitHash];

            const error = await getGitService().runGitCommand(args, input.repo);
            return { errors: error ? [error] : [] };
        }),

    /**
     * Delete a branch.
     */
    deleteBranch: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                branchName: z.string(),
                force: z.boolean(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['branch', input.force ? '-D' : '-d', input.branchName],
                input.repo
            );
            return { error };
        }),

    /**
     * Fetch from remote(s).
     */
    fetch: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                remote: z.string().nullable(),
                prune: z.boolean(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['fetch', input.remote ?? '--all'];
            if (input.prune) args.push('--prune');

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Pull from remote.
     */
    pull: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                branchName: z.string(),
                remote: z.string(),
                noFastForward: z.boolean(),
                fastForwardOnly: z.boolean().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            if (input.noFastForward && input.fastForwardOnly) {
                return { error: 'Cannot use both --no-ff and --ff-only for pull.' };
            }

            const args = ['pull'];
            if (input.fastForwardOnly) {
                args.push('--ff-only');
            } else if (input.noFastForward) {
                args.push('--no-ff');
            }
            args.push(input.remote, input.branchName);

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Push to remote.
     */
    push: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                branchName: z.string(),
                remote: z.string(),
                setUpstream: z.boolean(),
                force: z.boolean().optional(),
                mode: z.enum(['normal', 'force', 'force-with-lease']).optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['push', input.remote, input.branchName];
            if (input.setUpstream) args.push('--set-upstream');
            const pushMode = input.mode ?? (input.force ? 'force' : 'normal');
            if (pushMode === 'force') {
                args.push('--force');
            } else if (pushMode === 'force-with-lease') {
                args.push('--force-with-lease');
            }

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Reset to commit.
     */
    reset: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHash: z.string(),
                mode: z.enum(['soft', 'mixed', 'hard']),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['reset', `--${input.mode}`, input.commitHash],
                input.repo
            );
            return { error };
        }),

    /**
     * Stash operations.
     */
    stash: router({
        list: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { stashes: [], error: initError };

            try {
                const stashes = await getGitService().getStashes(input.repo);
                return { stashes, error: null };
            } catch (error) {
                return {
                    stashes: [],
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

        push: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    message: z.string().optional(),
                    includeUntracked: z.boolean(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const args = ['stash', 'push'];
                if (input.includeUntracked) args.push('--include-untracked');
                if (input.message) args.push('--message', input.message);

                const error = await getGitService().runGitCommand(args, input.repo);
                return { error };
            }),

        pop: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    selector: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(['stash', 'pop', input.selector], input.repo);
                return { error };
            }),

        drop: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    selector: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(['stash', 'drop', input.selector], input.repo);
                return { error };
            }),

        applyStash: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    selector: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(['stash', 'apply', input.selector], input.repo);
                return { error };
            }),
    }),

    /**
     * Tag operations.
     */
    tag: router({
        create: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    tagName: z.string(),
                    commitHash: z.string(),
                    message: z.string().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const args = input.message
                    ? ['tag', '-a', input.tagName, '-m', input.message, input.commitHash]
                    : ['tag', input.tagName, input.commitHash];

                const error = await getGitService().runGitCommand(args, input.repo);
                return { error };
            }),

        delete: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    tagName: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(['tag', '-d', input.tagName], input.repo);
                return { error };
            }),
    }),

    /**
     * Merge a branch.
     */
    merge: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                branch: z.string(),
                noFastForward: z.boolean().optional(),
                squash: z.boolean().optional(),
                noCommit: z.boolean().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['merge'];
            if (input.noFastForward) args.push('--no-ff');
            if (input.squash) args.push('--squash');
            if (input.noCommit) args.push('--no-commit');
            args.push(input.branch);

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Rebase current branch onto a commit/branch.
     */
    rebase: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                onto: z.string(),
                interactive: z.boolean().optional(),
                todos: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['rebase'];
            if (input.interactive) args.push('-i');
            args.push(input.onto);

            let error = null;

            if (input.interactive) {
                if (!input.todos?.trim()) {
                    error = 'Interactive rebase requires a todo list.';
                } else {
                    error = await runRebaseCommandWithOptionalTodos(args, input.repo, input.todos);
                }
            } else {
                error = await getGitService().runGitCommand(args, input.repo);
            }

            return { error };
        }),

    /**
     * Preview a merge before executing.
     */
    mergePreview: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                source: z.string(),
                target: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            try {
                // Check if merge is possible (dry run)
                await getGitService().runGitCommandWithOutput(
                    ['merge', '--no-commit', '--no-ff', input.source],
                    input.repo
                );

                // Get conflicts if any
                const statusOutput = await getGitService().runGitCommandWithOutput(['status', '--porcelain'], input.repo);
                const conflicts = parseConflictedFilesFromStatusOutput(statusOutput);

                // Abort the dry-run merge
                await getGitService().runGitCommand(['merge', '--abort'], input.repo);

                // Get commits that would be merged
                const logResult = await getGitService().runGitCommandWithOutput(
                    ['log', `${input.target}..${input.source}`, '--oneline'],
                    input.repo
                );
                const aheadCommits = (logResult ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const [hash, ...msgParts] = line.split(' ');
                        return { hash: hash ?? '', message: msgParts.join(' ') };
                    });

                // Get files that would change
                const diffResult = await getGitService().runGitCommandWithOutput(
                    ['diff', '--stat', `${input.target}...${input.source}`],
                    input.repo
                );
                const files = (diffResult ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const match = line.match(/^(.+?)\s*\|\s*(\d+)/);
                        if (match) {
                            return { path: match[1]?.trim() ?? '', changes: parseInt(match[2] ?? '0', 10) || 0 };
                        }
                        return { path: line.trim(), changes: 0 };
                    });

                return {
                    canMerge: conflicts.length === 0,
                    conflicts,
                    aheadCommits,
                    files,
                    warnings: [],
                };
            } catch {
                // Merge would have conflicts
                const statusOutput = await getGitService().runGitCommandWithOutput(['status', '--porcelain'], input.repo);
                await getGitService().runGitCommand(['merge', '--abort'], input.repo);

                return {
                    canMerge: false,
                    conflicts: parseConflictedFilesFromStatusOutput(statusOutput),
                    aheadCommits: [],
                    files: [],
                    warnings: ['Merge conflicts detected'],
                };
            }
        }),

    /**
     * Continue an interactive rebase.
     *
     * @deprecated Use rebaseContinue for active operations. Kept for compatibility.
     */
    continueRebase: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                todos: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await runRebaseCommandWithOptionalTodos(['rebase', '--continue'], input.repo, input.todos);
            return { error };
        }),

    /**
     * Abort an interactive rebase.
     *
     * @deprecated Use rebaseAbort for active operations. Kept for compatibility.
     */
    abortRebase: publicProcedure
        .input(
            z.object({
                repo: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(['rebase', '--abort'], input.repo);
            return { error };
        }),

    /**
     * Start a git bisect.
     */
    bisectStart: publicProcedure
        .input(
            z.object({
                repo: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(['bisect', 'start'], input.repo);
            return { error };
        }),

    /**
     * Get bisect status.
     */
    bisectStatus: publicProcedure
        .input(
            z.object({
                repo: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { isActive: false };

            try {
                const result = await getGitService().runGitCommandWithOutput(['bisect', 'log'], input.repo);

                // Parse bisect log to determine state
                const isActive = result && !result.includes('We are not bisecting');
                const badMatch = result?.match(/bisect-bad=([a-f0-9]+)/);
                const goodMatch = result?.match(/bisect-good=([a-f0-9]+)/g);

                return {
                    isActive,
                    badCommit: badMatch ? badMatch[1] : null,
                    goodCommits: goodMatch?.map((m) => m.split('=')[1]) || [],
                    currentCommit: null, // Would need git bisect visualize
                    remaining: 0,
                    culprit: null,
                };
            } catch {
                return { isActive: false };
            }
        }),

    /**
     * Mark commit as bad in bisect.
     */
    bisectBad: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commit: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['bisect', 'bad'];
            if (input.commit) args.push(input.commit);

            const result = await getGitService().runGitCommandWithOutput(args, input.repo);

            // Check if culprit found
            if (result?.includes('is the first bad commit')) {
                const match = result.match(/([a-f0-9]{40}) is the first bad commit/);
                return {
                    culprit: match ? match[1] : null,
                    nextCommit: null,
                    remaining: 0,
                    steps: 0,
                };
            }

            // Parse remaining steps
            const stepsMatch = result?.match(/roughly (\d+) steps/);
            const remainingMatch = result?.match(/\((\d+) commits/);

            return {
                culprit: null,
                nextCommit: null,
                remaining: parseInt(remainingMatch?.[1] ?? '0', 10) || 0,
                steps: parseInt(stepsMatch?.[1] ?? '0', 10) || 0,
            };
        }),

    /**
     * Mark commit as good in bisect.
     */
    bisectGood: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commit: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['bisect', 'good'];
            if (input.commit) args.push(input.commit);

            const result = await getGitService().runGitCommandWithOutput(args, input.repo);

            // Check if culprit found
            if (result?.includes('is the first bad commit')) {
                const match = result.match(/([a-f0-9]{40}) is the first bad commit/);
                return {
                    culprit: match ? match[1] : null,
                    nextCommit: null,
                    remaining: 0,
                    steps: 0,
                };
            }

            // Parse remaining steps
            const stepsMatch = result?.match(/roughly (\d+) steps/);
            const remainingMatch = result?.match(/\((\d+) commits/);

            return {
                culprit: null,
                nextCommit: null,
                remaining: parseInt(remainingMatch?.[1] ?? '0', 10) || 0,
                steps: parseInt(stepsMatch?.[1] ?? '0', 10) || 0,
            };
        }),

    /**
     * Skip current commit in bisect.
     */
    bisectSkip: publicProcedure
        .input(
            z.object({
                repo: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const result = await getGitService().runGitCommandWithOutput(['bisect', 'skip'], input.repo);

            const stepsMatch = result?.match(/roughly (\d+) steps/);
            const remainingMatch = result?.match(/\((\d+) commits/);

            return {
                nextCommit: null,
                remaining: parseInt(remainingMatch?.[1] ?? '0', 10) || 0,
                steps: parseInt(stepsMatch?.[1] ?? '0', 10) || 0,
            };
        }),

    /**
     * Reset bisect.
     */
    bisectReset: publicProcedure
        .input(
            z.object({
                repo: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(['bisect', 'reset'], input.repo);
            return { error };
        }),

    /**
     * Cherry-pick a commit.
     */
    cherryPick: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHash: z.string(),
                noCommit: z.boolean().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['cherry-pick'];
            if (input.noCommit) args.push('--no-commit');
            args.push(input.commitHash);

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Squash selected contiguous commits on the current branch.
     */
    squashCommits: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHashes: z.array(z.string()).min(1),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const plan = await buildSelectedCommitRebaseTodo(input.repo, input.commitHashes, 'fixup');
            if (plan.error) return { error: plan.error };

            const error = await runRebaseCommandWithOptionalTodos(plan.args, input.repo, plan.todos);
            return { error };
        }),

    /**
     * Drop selected commits from the current branch history.
     */
    dropCommits: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHashes: z.array(z.string()).min(1),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const plan = await buildSelectedCommitRebaseTodo(input.repo, input.commitHashes, 'drop');
            if (plan.error) return { error: plan.error };

            const error = await runRebaseCommandWithOptionalTodos(plan.args, input.repo, plan.todos);
            return { error };
        }),

    /**
     * Revert a commit.
     */
    revert: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHash: z.string(),
                noCommit: z.boolean().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['revert'];
            if (input.noCommit) args.push('--no-commit');
            args.push(input.commitHash);

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Copy text to clipboard.
     */
    copyToClipboard: publicProcedure.input(z.object({ text: z.string() })).mutation(async ({ input }) => {
        // In Electron, we can use clipboard API
        const { clipboard } = await import('electron');
        clipboard.writeText(input.text);
        return { success: true };
    }),

    /**
     * Get remote URL for a repository.
     */
    getRemoteUrl: publicProcedure.input(z.object({ repo: z.string(), remote: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { url: null, error: initError };

        try {
            // Use git config to get remote URL
            const { execFile } = await import('child_process');
            const executable = getGitService().getGitExecutable();

            if (!executable) {
                return { url: null, error: 'Git not initialized' };
            }

            const url = await new Promise<string | null>((resolve) => {
                execFile(
                    executable.path,
                    ['config', '--get', `remote.${input.remote}.url`],
                    { cwd: input.repo },
                    (error, stdout) => {
                        resolve(error ? null : stdout.trim());
                    }
                );
            });

            return { url, error: null };
        } catch (error) {
            return { url: null, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    /**
     * Detect issue linking from remote URL.
     */
    detectIssueLinking: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { config: null, error: initError };

        try {
            // Use git config to get remote.origin.url
            const { execFile } = await import('child_process');
            const executable = getGitService().getGitExecutable();

            if (!executable) {
                return { config: null, error: 'Git not initialized' };
            }

            const url = await new Promise<string | null>((resolve) => {
                execFile(
                    executable.path,
                    ['config', '--get', 'remote.origin.url'],
                    { cwd: input.repo },
                    (error, stdout) => {
                        resolve(error ? null : stdout.trim());
                    }
                );
            });

            if (!url) {
                return { config: null, error: null };
            }

            // Detect platform from URL
            let config: { issue: string; url: string } | null = null;

            // Extract repo path
            const httpsMatch = url.match(/https?:\/\/[^/]+\/([^/]+\/[^/]+?)(?:\.git)?$/);
            const sshMatch = url.match(/git@[^:]+:([^/]+\/[^/]+?)(?:\.git)?$/);
            const azureHttpsMatch = url.match(
                /https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+?)(?:\.git)?$/i
            );
            const azureVisualStudioMatch = url.match(
                /https?:\/\/([^/.]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/]+?)(?:\.git)?$/i
            );
            const azureSshMatch = url.match(/git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
            const repoPath = httpsMatch?.[1] ?? sshMatch?.[1];

            if (repoPath) {
                if (url.includes('github.com')) {
                    config = {
                        issue: '#(\\d+)',
                        url: `https://github.com/${repoPath}/issues/{issue}`,
                    };
                } else if (url.includes('gitlab.com')) {
                    config = {
                        issue: '#(\\d+)',
                        url: `https://gitlab.com/${repoPath}/-/issues/{issue}`,
                    };
                } else if (url.includes('bitbucket.org')) {
                    config = {
                        issue: '#(\\d+)',
                        url: `https://bitbucket.org/${repoPath}/issues/{issue}`,
                    };
                }
            } else if (azureHttpsMatch?.[1] && azureHttpsMatch[2]) {
                const organization = azureHttpsMatch[1];
                const project = azureHttpsMatch[2];
                config = {
                    issue: 'AB#(\\d+)|#(\\d+)',
                    url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/{issue}`,
                };
            } else if (azureVisualStudioMatch?.[1] && azureVisualStudioMatch[2]) {
                const organization = azureVisualStudioMatch[1];
                const project = azureVisualStudioMatch[2];
                config = {
                    issue: 'AB#(\\d+)|#(\\d+)',
                    url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/{issue}`,
                };
            } else if (azureSshMatch?.[1] && azureSshMatch[2]) {
                const organization = azureSshMatch[1];
                const project = azureSshMatch[2];
                config = {
                    issue: 'AB#(\\d+)|#(\\d+)',
                    url: `https://dev.azure.com/${organization}/${project}/_workitems/edit/{issue}`,
                };
            }

            return { config, error: null };
        } catch (error) {
            return { config: null, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    /**
     * Get list of remotes with URLs.
     */
    remotes: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { remotes: [], error: initError };

        try {
            const gitService = getGitService();
            const remoteNames = await gitService.getRemotes(input.repo);

            // Get URL for each remote
            const remotes = await Promise.all(
                remoteNames.map(async (name) => {
                    const url = await gitService.runGitCommandWithOutput(
                        ['config', '--get', `remote.${name}.url`],
                        input.repo
                    );
                    const pushUrl = await gitService.runGitCommandWithOutput(
                        ['config', '--get', `remote.${name}.pushurl`],
                        input.repo
                    );
                    return {
                        name,
                        url: url?.trim() ?? '',
                        pushUrl: pushUrl?.trim() || undefined,
                    };
                })
            );

            return { remotes, error: null };
        } catch (error) {
            return { remotes: [], error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    /**
     * Remote operations.
     */
    remote: router({
        add: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    name: z.string(),
                    url: z.string(),
                    pushUrl: z.string().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const gitService = getGitService();
                const error = await gitService.runGitCommand(['remote', 'add', input.name, input.url], input.repo);

                if (!error && input.pushUrl) {
                    await gitService.runGitCommand(
                        ['remote', 'set-url', '--push', input.name, input.pushUrl],
                        input.repo
                    );
                }

                return { error };
            }),

        remove: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    name: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(['remote', 'remove', input.name], input.repo);
                return { error };
            }),

        update: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    name: z.string(),
                    url: z.string(),
                    pushUrl: z.string().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const gitService = getGitService();

                // Update fetch URL
                const error = await gitService.runGitCommand(['remote', 'set-url', input.name, input.url], input.repo);

                if (!error) {
                    // Update push URL if provided
                    if (input.pushUrl) {
                        await gitService.runGitCommand(
                            ['remote', 'set-url', '--push', input.name, input.pushUrl],
                            input.repo
                        );
                    } else {
                        // Clear custom push URL to use fetch URL
                        await gitService.runGitCommand(
                            ['remote', 'set-url', '--push', input.name, input.url],
                            input.repo
                        );
                    }
                }

                return { error };
            }),

        prune: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    name: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(['remote', 'prune', input.name], input.repo);
                return { error };
            }),

        refspec: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    name: z.string(),
                })
            )
            .query(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { fetch: [], push: [], error: initError };

                try {
                    const gitService = getGitService();
                    const [fetchOutput, pushOutput] = await Promise.all([
                        gitService.runGitCommandWithOutput(['config', '--get-all', `remote.${input.name}.fetch`], input.repo),
                        gitService.runGitCommandWithOutput(['config', '--get-all', `remote.${input.name}.push`], input.repo),
                    ]);

                    const fetch = (fetchOutput ?? '')
                        .split('\n')
                        .map((entry) => entry.trim())
                        .filter(Boolean);
                    const push = (pushOutput ?? '')
                        .split('\n')
                        .map((entry) => entry.trim())
                        .filter(Boolean);

                    return { fetch, push, error: null };
                } catch (error) {
                    return { fetch: [], push: [], error: error instanceof Error ? error.message : 'Unknown error' };
                }
            }),

        setRefspec: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    name: z.string(),
                    fetch: z.array(z.string()).optional(),
                    push: z.array(z.string()).optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const gitService = getGitService();
                const remote = input.name;

                if (input.fetch !== undefined) {
                    await gitService.runGitCommand(['config', '--unset-all', `remote.${remote}.fetch`], input.repo);
                    for (const refspec of input.fetch) {
                        const trimmed = refspec.trim();
                        if (!trimmed) continue;
                        const addError = await gitService.runGitCommand(
                            ['config', '--add', `remote.${remote}.fetch`, trimmed],
                            input.repo
                        );
                        if (addError) {
                            return { error: addError };
                        }
                    }
                }

                if (input.push !== undefined) {
                    await gitService.runGitCommand(['config', '--unset-all', `remote.${remote}.push`], input.repo);
                    for (const refspec of input.push) {
                        const trimmed = refspec.trim();
                        if (!trimmed) continue;
                        const addError = await gitService.runGitCommand(
                            ['config', '--add', `remote.${remote}.push`, trimmed],
                            input.repo
                        );
                        if (addError) {
                            return { error: addError };
                        }
                    }
                }

                return { error: null };
            }),
    }),

    // ==================== Additional Features ====================

    /**
     * Rename a branch.
     */
    renameBranch: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                oldName: z.string(),
                newName: z.string(),
                force: z.boolean().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['branch', input.force ? '-M' : '-m'];
            args.push(input.oldName, input.newName);

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Set upstream tracking branch for a local branch.
     */
    setBranchUpstream: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                branchName: z.string(),
                upstream: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['branch', '--set-upstream-to', input.upstream, input.branchName],
                input.repo
            );
            return { error };
        }),

    /**
     * Delete a remote branch.
     */
    deleteRemoteBranch: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                remote: z.string(),
                branchName: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['push', input.remote, '--delete', input.branchName],
                input.repo
            );
            return { error };
        }),

    /**
     * Abort a merge.
     */
    mergeAbort: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['merge', '--abort'], input.repo);
        return { error };
    }),

    /**
     * Continue a merge after resolving conflicts.
     */
    mergeContinue: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                message: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['merge', '--continue'];
            if (input.message) {
                args.push('-m', input.message);
            }

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Create a commit.
     */
    commit: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                message: z.string(),
                amend: z.boolean().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['commit', '-m', input.message];
            if (input.amend) {
                args.push('--amend');
            }

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    /**
     * Get working tree status (changed files).
     */
    workingTreeStatus: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { staged: [], unstaged: [], error: initError };

        try {
            const gitService = getGitService();
            const output = await gitService.runGitCommandWithOutput(['status', '--porcelain', '-z'], input.repo);

            const staged: Array<{ file: string; status: string }> = [];
            const unstaged: Array<{ file: string; status: string }> = [];

            const entries = (output ?? '').split('\0').filter(Boolean);
            for (const entry of entries) {
                if (entry.length < 4) continue;
                const indexStatus = entry[0];
                const workTreeStatus = entry[1];
                const file = entry.substring(3);

                // Index status (staged)
                if (indexStatus && indexStatus !== ' ' && indexStatus !== '?') {
                    staged.push({
                        file,
                        status: indexStatus === 'A' ? 'A' : indexStatus === 'D' ? 'D' : 'M',
                    });
                }

                // Work tree status (unstaged)
                if (workTreeStatus && workTreeStatus !== ' ') {
                    unstaged.push({
                        file,
                        status: workTreeStatus === '?' ? 'U' : workTreeStatus === 'D' ? 'D' : 'M',
                    });
                }
            }

            return { staged, unstaged, error: null };
        } catch (error) {
            return { staged: [], unstaged: [], error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    /**
     * Stage files for commit.
     */
    stage: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                files: z.array(z.string()),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const safeFiles = input.files.map(validateGitPath);
            if (safeFiles.length === 0) {
                return { error: 'No files provided' };
            }
            const error = await getGitService().runGitCommand(['add', '--', ...safeFiles], input.repo);
            return { error };
        }),

    /**
     * Unstage files.
     */
    unstage: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                files: z.array(z.string()),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const safeFiles = input.files.map(validateGitPath);
            if (safeFiles.length === 0) {
                return { error: 'No files provided' };
            }
            const error = await getGitService().runGitCommand(['reset', 'HEAD', '--', ...safeFiles], input.repo);
            return { error };
        }),

    /**
     * Abort a rebase.
     */
    rebaseAbort: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['rebase', '--abort'], input.repo);
        return { error };
    }),

    /**
     * Continue a rebase after resolving conflicts.
     */
    rebaseContinue: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                todos: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await runRebaseCommandWithOptionalTodos(['rebase', '--continue'], input.repo, input.todos);
            return { error };
        }),

    /**
     * Skip current patch during rebase.
     */
    rebaseSkip: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['rebase', '--skip'], input.repo);
        return { error };
    }),

    /**
     * Abort a cherry-pick.
     */
    cherryPickAbort: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['cherry-pick', '--abort'], input.repo);
        return { error };
    }),

    /**
     * Continue a cherry-pick after resolving conflicts.
     */
    cherryPickContinue: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['cherry-pick', '--continue'], input.repo);
        return { error };
    }),

    /**
     * Skip current cherry-pick.
     */
    cherryPickSkip: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['cherry-pick', '--skip'], input.repo);
        return { error };
    }),

    /**
     * Abort a revert.
     */
    revertAbort: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['revert', '--abort'], input.repo);
        return { error };
    }),

    /**
     * Continue a revert after resolving conflicts.
     */
    revertContinue: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['revert', '--continue'], input.repo);
        return { error };
    }),

    /**
     * Quit a revert (skip current).
     */
    revertSkip: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['revert', '--skip'], input.repo);
        return { error };
    }),

    /**
     * Get current operation state (merge/rebase/cherry-pick/revert in progress).
     */
    operationState: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { state: null, error: initError };

        try {
            const gitService = getGitService();
            const gitDir = await getGitDir(input.repo);
            if (!gitDir) {
                return { state: null, error: 'Could not determine .git directory' };
            }

            // Check for various operation states
            const state = {
                merging: false,
                rebasing: false,
                cherryPicking: false,
                reverting: false,
                bisecting: false,
                conflicts: [] as string[],
            };

            // Check merge state
            try {
                await fs.access(path.join(gitDir, 'MERGE_HEAD'));
                state.merging = true;
            } catch {}

            // Check rebase state
            try {
                await fs.access(path.join(gitDir, 'rebase-merge'));
                state.rebasing = true;
            } catch {
                try {
                    await fs.access(path.join(gitDir, 'rebase-apply'));
                    state.rebasing = true;
                } catch {}
            }

            // Check cherry-pick state
            try {
                await fs.access(path.join(gitDir, 'CHERRY_PICK_HEAD'));
                state.cherryPicking = true;
            } catch {}

            // Check revert state
            try {
                await fs.access(path.join(gitDir, 'REVERT_HEAD'));
                state.reverting = true;
            } catch {}

            // Check bisect state
            try {
                await fs.access(path.join(gitDir, 'BISECT_LOG'));
                state.bisecting = true;
            } catch {}

            // Get conflict list
            const statusOutput = await gitService.runGitCommandWithOutput(['status', '--porcelain'], input.repo);

            if (statusOutput) {
                for (const line of statusOutput.split('\n').filter(Boolean)) {
                    const index = line[0];
                    const workTree = line[1];
                    if (
                        index === 'U' ||
                        workTree === 'U' ||
                        (index === 'A' && workTree === 'A') ||
                        (index === 'D' && workTree === 'D')
                    ) {
                        state.conflicts.push(line.slice(3));
                    }
                }
            }

            return { state, error: null };
        } catch (error) {
            return { state: null, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    /**
     * Get active rebase todo list for an in-progress rebase.
     */
    rebaseTodo: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { source: null, rawTodo: '', todos: [], error: initError };

        try {
            const gitDir = await getGitDir(input.repo);
            if (!gitDir) {
                return {
                    source: null,
                    rawTodo: '',
                    todos: [],
                    error: 'Could not determine .git directory',
                };
            }

            const rebaseTodo = await readRebaseTodo(gitDir);
            if (!rebaseTodo) {
                return {
                    source: null,
                    rawTodo: '',
                    todos: [],
                    error: 'No active rebase todo file found',
                };
            }

            return {
                source: rebaseTodo.source,
                rawTodo: rebaseTodo.rawTodo,
                todos: rebaseTodo.todos,
                error: null,
            };
        } catch (error) {
            return {
                source: null,
                rawTodo: '',
                todos: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }),

    /**
     * Resolve a merge conflict.
     */
    resolveConflict: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                path: z.string(),
                resolution: z.enum(['ours', 'theirs', 'both']),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const gitService = getGitService();
            const safePath = validateGitPath(input.path);

            if (input.resolution === 'both') {
                const [ours, theirs] = await Promise.all([
                    gitService.runGitCommandWithOutput(['show', `:2:${safePath}`], input.repo),
                    gitService.runGitCommandWithOutput(['show', `:3:${safePath}`], input.repo),
                ]);

                if (ours === null || theirs === null) {
                    return { error: `Unable to read conflict stages for ${safePath}` };
                }

                const mergedContent = `${ours}${ours.endsWith('\n') || theirs.length === 0 ? '' : '\n'}${theirs}`;
                const targetPath = resolveRepoPath(input.repo, safePath);
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await fs.mkdir(path.dirname(targetPath), { recursive: true });
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await fs.writeFile(targetPath, mergedContent, 'utf8');

                const stageError = await gitService.runGitCommand(['add', '--', safePath], input.repo);
                return { error: stageError };
            }

            const args = ['checkout', input.resolution === 'ours' ? '--ours' : '--theirs', '--', safePath];
            const error = await gitService.runGitCommand(args, input.repo);

            if (!error) {
                await gitService.runGitCommand(['add', '--', safePath], input.repo);
            }

            return { error };
        }),

    /**
     * Enable or disable rerere (reuse recorded resolution).
     */
    rerereStatus: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { enabled: false, error: initError };

        try {
            const gitService = getGitService();
            const output = await gitService.runGitCommandWithOutput(['config', '--get', 'rerere.enabled'], input.repo);

            return { enabled: (output ?? '').trim() === 'true', error: null };
        } catch {
            return { enabled: false, error: null };
        }
    }),

    /**
     * Enable rerere.
     */
    rerereEnable: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const gitService = getGitService();
        const error = await gitService.runGitCommand(['config', 'rerere.enabled', 'true'], input.repo);

        return { error };
    }),

    /**
     * Disable rerere.
     */
    rerereDisable: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const gitService = getGitService();
        const error = await gitService.runGitCommand(['config', '--unset', 'rerere.enabled'], input.repo);

        return { error };
    }),

    /**
     * Get list of recorded rerere resolutions.
     */
    rerereList: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { recordings: [], error: initError };

        try {
            // Get the git directory
            const gitDir = await getGitDir(input.repo);
            if (!gitDir) {
                return { recordings: [], error: 'Not a git repository' };
            }

            const rrCache = await import('node:fs/promises');
            const rrPath = path.join(gitDir, 'rr-cache');

            try {
                const entries = await rrCache.readdir(rrPath, { withFileTypes: true });
                const recordings = entries
                    .filter((e) => e.isDirectory())
                    .map((e) => ({
                        hash: e.name,
                        path: path.join(rrPath, e.name),
                    }));

                return { recordings, error: null };
            } catch {
                // rr-cache doesn't exist, no recordings
                return { recordings: [], error: null };
            }
        } catch (error) {
            return { recordings: [], error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    /**
     * Clear rerere cache.
     */
    rerereClear: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const gitService = getGitService();
        const error = await gitService.runGitCommand(['rerere', 'clear'], input.repo);

        return { error };
    }),

    /**
     * Get file blame.
     */
    blame: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                path: z.string(),
                commitHash: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { blame: null, error: initError };

            try {
                const gitService = getGitService();
                const args = ['blame', '--line-porcelain'];
                if (input.commitHash) {
                    args.push(input.commitHash);
                }
                args.push('--', input.path);

                const blame = await gitService.runGitCommandWithOutput(args, input.repo);
                return { blame, error: null };
            } catch (error) {
                return { blame: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Get file history.
     */
    fileHistory: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                path: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { history: [], error: initError };

            try {
                const gitService = getGitService();
                const output = await gitService.runGitCommandWithOutput(
                    ['log', '--follow', '--oneline', '--numstat', '--', input.path],
                    input.repo
                );

                // Parse the output
                const history: Array<{
                    hash: string;
                    author: string;
                    date: string;
                    message: string;
                    additions: number;
                    deletions: number;
                }> = [];

                const lines = (output ?? '').split('\n');
                for (const line of lines) {
                    const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
                    if (match) {
                        history.push({
                            hash: match[1] ?? '',
                            message: match[2] ?? '',
                            author: '',
                            date: '',
                            additions: 0,
                            deletions: 0,
                        });
                    }
                }

                return { history, error: null };
            } catch (error) {
                return { history: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Get reflog entries.
     */
    reflog: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { entries: [], error: initError };

        try {
            const gitService = getGitService();
            const output = await gitService.runGitCommandWithOutput(
                ['reflog', '--format=%H|%gd|%gs|%s|%ci'],
                input.repo
            );

            const entries = (output ?? '')
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                    const [hash, ref, action, message, date] = line.split('|');
                    return { hash, ref, action, message, date };
                });

            return { entries, error: null };
        } catch (error) {
            return { entries: [], error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    /**
     * Create an archive.
     */
    archive: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                ref: z.string(),
                format: z.enum(['zip', 'tar', 'tar.gz']),
                outputPath: z.string().optional(),
                prefix: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError, path: null };

            try {
                const { dialog } = await import('electron');

                // If no output path, show save dialog
                let outputPath = input.outputPath;
                if (!outputPath) {
                    const result = await dialog.showSaveDialog({
                        defaultPath: `${input.ref}.${input.format}`,
                        filters: [
                            { name: 'Archive', extensions: [input.format === 'tar.gz' ? 'tar.gz' : input.format] },
                        ],
                    });

                    if (result.canceled || !result.filePath) {
                        return { error: 'Cancelled', path: null };
                    }
                    outputPath = result.filePath;
                }

                const gitService = getGitService();
                const args = ['archive', `--format=${input.format}`, `--output=${outputPath}`];
                if (input.prefix) {
                    args.push(`--prefix=${input.prefix}`);
                }
                args.push(input.ref);

                const error = await gitService.runGitCommand(args, input.repo);
                return { error, path: outputPath };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error', path: null };
            }
        }),

    /**
     * Submodule operations.
     */
    submodule: router({
        list: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { submodules: [], error: initError };

            try {
                const gitService = getGitService();
                const output = await gitService.runGitCommandWithOutput(['submodule', 'status'], input.repo);

                const submodules = (output ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const match = line.match(/^\s*([+-U ])?([a-f0-9]+)\s+([^\s]+)\s+\(([^)]+)\)?/);
                        if (match) {
                            return {
                                currentCommit: match[2],
                                path: match[3],
                                branch: match[4],
                                status: match[1] === '+' ? 'modified' : match[1] === '-' ? 'uninitialized' : 'clean',
                            };
                        }
                        return null;
                    })
                    .filter(Boolean);

                return { submodules, error: null };
            } catch (error) {
                return { submodules: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

        add: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    url: z.string(),
                    path: z.string(),
                    branch: z.string().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const args = ['submodule', 'add'];
                if (input.branch) {
                    args.push('-b', input.branch);
                }
                args.push(input.url, input.path);

                const error = await getGitService().runGitCommand(args, input.repo);
                return { error };
            }),

        update: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    path: z.string().optional(),
                    init: z.boolean().optional(),
                    recursive: z.boolean().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const args = ['submodule', 'update'];
                if (input.init) args.push('--init');
                if (input.recursive) args.push('--recursive');
                if (input.path) args.push(input.path);

                const error = await getGitService().runGitCommand(args, input.repo);
                return { error };
            }),

        remove: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    path: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(
                    ['submodule', 'deinit', '-f', input.path],
                    input.repo
                );
                if (!error) {
                    await getGitService().runGitCommand(['rm', '-f', input.path], input.repo);
                }
                return { error };
            }),
    }),

    /**
     * Git Flow operations.
     */
    flow: router({
        status: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { initialized: false, error: initError };

            try {
                const gitService = getGitService();

                // Check if git flow is initialized by looking for config
                const config = await gitService.runGitCommandWithOutput(
                    ['config', '--get', 'gitflow.branch.master'],
                    input.repo
                );

                const initialized = !!config && !config.includes('error');

                return { initialized, activeBranches: {}, error: null };
            } catch {
                return { initialized: false, activeBranches: {}, error: null };
            }
        }),

        init: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    prefixes: z.object({
                        feature: z.string(),
                        release: z.string(),
                        hotfix: z.string(),
                        support: z.string(),
                        versionTag: z.string().optional(),
                    }),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const gitService = getGitService();

                // Set git flow config
                await gitService.runGitCommand(
                    ['config', 'gitflow.prefix.feature', input.prefixes.feature],
                    input.repo
                );
                await gitService.runGitCommand(
                    ['config', 'gitflow.prefix.release', input.prefixes.release],
                    input.repo
                );
                await gitService.runGitCommand(['config', 'gitflow.prefix.hotfix', input.prefixes.hotfix], input.repo);
                await gitService.runGitCommand(
                    ['config', 'gitflow.prefix.support', input.prefixes.support],
                    input.repo
                );
                await gitService.runGitCommand(['config', 'gitflow.branch.master', 'main'], input.repo);
                await gitService.runGitCommand(['config', 'gitflow.branch.develop', 'develop'], input.repo);

                // Create develop branch if it doesn't exist
                await gitService.runGitCommand(['checkout', '-b', 'develop'], input.repo);

                return { error: null };
            }),

        start: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    type: z.enum(['feature', 'release', 'hotfix', 'support']),
                    name: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                // Get prefix from config
                const gitService = getGitService();
                const prefix = await gitService.runGitCommandWithOutput(
                    ['config', '--get', `gitflow.prefix.${input.type}`],
                    input.repo
                );

                const branchName = `${(prefix ?? '').trim()}${input.name}`;

                // Determine base branch
                const baseBranch =
                    input.type === 'feature'
                        ? 'develop'
                        : input.type === 'release'
                          ? 'develop'
                          : input.type === 'hotfix'
                            ? 'main'
                            : 'main';

                const error = await gitService.runGitCommand(['checkout', '-b', branchName, baseBranch], input.repo);
                return { error };
            }),

        finish: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    type: z.enum(['feature', 'release', 'hotfix', 'support']),
                    name: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const gitService = getGitService();
                const prefix = await gitService.runGitCommandWithOutput(
                    ['config', '--get', `gitflow.prefix.${input.type}`],
                    input.repo
                );

                const branchName = `${(prefix ?? '').trim()}${input.name}`;

                if (input.type === 'feature') {
                    // Merge back to develop
                    await gitService.runGitCommand(['checkout', 'develop'], input.repo);
                    const error = await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
                    if (!error) {
                        await gitService.runGitCommand(['branch', '-d', branchName], input.repo);
                    }
                    return { error };
                } else if (input.type === 'release') {
                    // Merge to main and develop
                    await gitService.runGitCommand(['checkout', 'main'], input.repo);
                    await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
                    await gitService.runGitCommand(['checkout', 'develop'], input.repo);
                    await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
                    await gitService.runGitCommand(['branch', '-d', branchName], input.repo);
                    return { error: null };
                } else if (input.type === 'hotfix') {
                    // Merge to main and develop
                    await gitService.runGitCommand(['checkout', 'main'], input.repo);
                    await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
                    await gitService.runGitCommand(['checkout', 'develop'], input.repo);
                    await gitService.runGitCommand(['merge', '--no-ff', branchName], input.repo);
                    await gitService.runGitCommand(['branch', '-d', branchName], input.repo);
                    return { error: null };
                }

                return { error: 'Unknown branch type' };
            }),
    }),

    /**
     * Worktree operations.
     */
    worktree: router({
        list: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { worktrees: [], error: initError };

            try {
                const gitService = getGitService();
                const output = await gitService.runGitCommandWithOutput(
                    ['worktree', 'list', '--porcelain'],
                    input.repo
                );
                const repoRoot = (await gitService.getRepoRoot(input.repo)) ?? path.resolve(input.repo);
                const parsedWorktrees = parseWorktreePorcelainRecords(output);
                const worktrees = await Promise.all(
                    parsedWorktrees.map(async (record, index) => {
                        const branchName = normalizeBranchRef(record.branchRef);
                        const upstream = branchName ? await getWorktreeUpstream(branchName, input.repo) : null;
                        const aheadBehind = branchName
                            ? await getWorktreeAheadBehind(branchName, upstream, input.repo)
                            : { ahead: 0, behind: 0 };
                        const dirtyCount = await getWorktreeDirtyCount(record.path);
                        const lastCommitAt = await getWorktreeLastCommitAt(record.path);
                        const isMain = path.resolve(record.path) === path.resolve(repoRoot) || index === 0;

                        return {
                            path: record.path,
                            branch: branchName ?? '',
                            commit: record.headSha ?? '',
                            isMain,
                            isCurrent: path.resolve(record.path) === path.resolve(input.repo),
                            isLocked: record.locked,
                            isPrunable: record.prunable,
                            locked: record.locked,
                            lockReason: record.lockReason,
                            detached: record.detached || !branchName,
                            prunable: record.prunable,
                            bare: record.bare,
                            head: branchName ?? record.headSha ?? null,
                            headRef: branchName,
                            headSha: record.headSha,
                            branchUpstream: upstream,
                            dirtyCount,
                            lastCommitAt,
                            ahead: aheadBehind.ahead,
                            behind: aheadBehind.behind,
                        };
                    })
                );
                return { worktrees, error: null };
            } catch (error) {
                return { worktrees: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

        add: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    path: z.string(),
                    branch: z.string().optional(),
                    mode: z.enum(['existing', 'new-branch', 'detached', 'ephemeral-review']).optional(),
                    baseRef: z.string().optional(),
                    newBranch: z.string().optional(),
                    commit: z.string().optional(),
                    detached: z.boolean().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const gitService = getGitService();
                const mode = input.mode ?? (input.branch ? 'existing' : 'new-branch');
                const targetPath = path.isAbsolute(input.path) ? input.path : path.resolve(input.repo, input.path);
                const args = ['worktree', 'add'];
                let branchCreated: string | null = null;

                if (mode === 'existing') {
                    const ref = input.branch ?? input.baseRef ?? input.commit;
                    if (!ref) {
                        return { error: 'A branch or ref is required for existing checkout mode.' };
                    }
                    args.push(targetPath, ref);
                } else if (mode === 'new-branch') {
                    const newBranchName = input.newBranch ?? input.branch;
                    const baseRef = input.baseRef ?? input.commit ?? 'HEAD';
                    if (!newBranchName) {
                        return { error: 'A new branch name is required for new-branch mode.' };
                    }
                    branchCreated = newBranchName;
                    args.push('-b', newBranchName, targetPath, baseRef);
                } else if (mode === 'detached') {
                    const detachedRef = input.commit ?? input.baseRef ?? 'HEAD';
                    args.push('--detach', targetPath, detachedRef);
                } else {
                    const shouldDetach = input.detached ?? false;
                    if (shouldDetach) {
                        args.push('--detach', targetPath, input.commit ?? input.baseRef ?? 'HEAD');
                    } else {
                        const generatedBranch =
                            input.newBranch ??
                            `review/${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').slice(0, 19)}`;
                        branchCreated = generatedBranch;
                        args.push('-b', generatedBranch, targetPath, input.baseRef ?? input.commit ?? 'HEAD');
                    }
                }

                const error = await gitService.runGitCommand(args, input.repo);
                return {
                    error,
                    mode,
                    branchCreated,
                    path: targetPath,
                };
            }),

        remove: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    path: z.string(),
                    force: z.boolean().optional(),
                    forceReason: z.string().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const gitService = getGitService();
                const repoRoot = (await gitService.getRepoRoot(input.repo)) ?? path.resolve(input.repo);
                const targetPath = path.isAbsolute(input.path) ? input.path : path.resolve(input.repo, input.path);

                if (path.resolve(targetPath) === path.resolve(repoRoot)) {
                    return { error: 'Cannot remove the active/main worktree.' };
                }

                const dirtyCount = await getWorktreeDirtyCount(targetPath);
                if (dirtyCount > 0 && !input.force) {
                    return {
                        error: `Worktree has ${String(dirtyCount)} uncommitted changes. Force removal requires a typed reason.`,
                    };
                }

                if (input.force && (input.forceReason?.trim().length ?? 0) < 4) {
                    return { error: 'Force removal requires a reason with at least 4 characters.' };
                }

                const args = ['worktree', 'remove'];
                if (input.force) {
                    args.push('--force');
                }
                args.push(targetPath);

                const error = await gitService.runGitCommand(args, input.repo);
                return { error, dirtyCount };
            }),

        prune: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    dryRun: z.boolean().optional(),
                    verbose: z.boolean().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError, entries: [] as string[] };

                const args = ['worktree', 'prune'];
                if (input.dryRun) {
                    args.push('--dry-run');
                }
                if (input.verbose ?? true) {
                    args.push('--verbose');
                }

                const output = await getGitService().runGitCommandWithOutput(args, input.repo);
                const entries = (output ?? '')
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean);
                return { error: null, entries };
            }),

        prunePreview: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { entries: [] as string[], error: initError };

            try {
                const output = await getGitService().runGitCommandWithOutput(
                    ['worktree', 'prune', '--dry-run', '--verbose'],
                    input.repo
                );
                const entries = (output ?? '')
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean);
                return { entries, error: null };
            } catch (error) {
                return { entries: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

        open: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    path: z.string(),
                })
            )
            .query(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { valid: false, resolvedPath: null, error: initError };

                const targetPath = path.isAbsolute(input.path) ? input.path : path.resolve(input.repo, input.path);
                const root = await getGitService().getRepoRoot(targetPath);
                return {
                    valid: Boolean(root),
                    resolvedPath: root ?? targetPath,
                    error: root ? null : 'Path is not a Git worktree.',
                };
            }),

        validatePath: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    path: z.string(),
                    allowNonEmpty: z.boolean().optional(),
                })
            )
            .query(async ({ input }) => {
                const candidate = path.isAbsolute(input.path) ? input.path : path.resolve(input.repo, input.path);
                try {
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    const stat = await fs.stat(candidate);
                    if (!stat.isDirectory()) {
                        return {
                            valid: false,
                            path: candidate,
                            exists: true,
                            empty: false,
                            error: 'Target path exists and is not a directory.',
                        };
                    }

                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    const entries = await fs.readdir(candidate);
                    const empty = entries.length === 0;
                    if (!empty && !input.allowNonEmpty) {
                        return {
                            valid: false,
                            path: candidate,
                            exists: true,
                            empty,
                            error: 'Target directory is not empty.',
                        };
                    }

                    return {
                        valid: true,
                        path: candidate,
                        exists: true,
                        empty,
                        error: null,
                    };
                } catch {
                    return {
                        valid: true,
                        path: candidate,
                        exists: false,
                        empty: true,
                        error: null,
                    };
                }
            }),

        lock: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    path: z.string(),
                    reason: z.string().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const targetPath = path.isAbsolute(input.path) ? input.path : path.resolve(input.repo, input.path);
                const args = ['worktree', 'lock'];
                if (input.reason?.trim()) {
                    args.push('--reason', input.reason.trim());
                }
                args.push(targetPath);
                const error = await getGitService().runGitCommand(args, input.repo);
                return { error };
            }),

        unlock: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    path: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const targetPath = path.isAbsolute(input.path) ? input.path : path.resolve(input.repo, input.path);
                const error = await getGitService().runGitCommand(['worktree', 'unlock', targetPath], input.repo);
                return { error };
            }),

        repair: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    paths: z.array(z.string()).optional(),
                    runPrune: z.boolean().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError, repaired: [] as string[], pruned: [] as string[] };

                const repairArgs = ['worktree', 'repair'];
                if (input.paths?.length) {
                    repairArgs.push(
                        ...input.paths.map((entry) =>
                            path.isAbsolute(entry) ? entry : path.resolve(input.repo, entry)
                        )
                    );
                }

                const repairedOutput = await getGitService().runGitCommandWithOutput(repairArgs, input.repo);
                const repaired = (repairedOutput ?? '')
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean);

                let pruned: string[] = [];
                if (input.runPrune ?? true) {
                    const pruneOutput = await getGitService().runGitCommandWithOutput(
                        ['worktree', 'prune', '--verbose'],
                        input.repo
                    );
                    pruned = (pruneOutput ?? '')
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean);
                }

                return {
                    error: null,
                    repaired,
                    pruned,
                };
            }),

        viewPrefs: publicProcedure.query(() => {
            const current = instanceStore.get('worktreeViewPrefs');
            return {
                prefs: {
                    showLocked: current.showLocked,
                    showPrunable: current.showPrunable,
                    defaultCreateMode: current.defaultCreateMode,
                    pathPresetRoot: current.pathPresetRoot,
                    lastSelectedBranch: current.lastSelectedBranch,
                },
                error: null as string | null,
            };
        }),

        setViewPrefs: publicProcedure
            .input(
                z.object({
                    showLocked: z.boolean().optional(),
                    showPrunable: z.boolean().optional(),
                    defaultCreateMode: z.enum(['existing', 'new-branch', 'detached', 'ephemeral-review']).optional(),
                    pathPresetRoot: z.string().nullable().optional(),
                    lastSelectedBranch: z.string().nullable().optional(),
                })
            )
            .mutation(({ input }) => {
                const current = instanceStore.get('worktreeViewPrefs');
                instanceStore.set('worktreeViewPrefs', {
                    showLocked: input.showLocked ?? current.showLocked,
                    showPrunable: input.showPrunable ?? current.showPrunable,
                    defaultCreateMode: input.defaultCreateMode ?? current.defaultCreateMode,
                    pathPresetRoot: input.pathPresetRoot ?? current.pathPresetRoot,
                    lastSelectedBranch: input.lastSelectedBranch ?? current.lastSelectedBranch,
                });
                return { success: true };
            }),
    }),

    /**
     * Get working directory status (including conflicts).
     */
    workingDirectoryStatus: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { staged: [], unstaged: [], conflicted: [], error: initError };

        try {
            const gitService = getGitService();
            const output = await gitService.runGitCommandWithOutput(['status', '--porcelain'], input.repo);

            const staged: string[] = [];
            const unstaged: string[] = [];
            const conflicted: string[] = [];

            for (const line of (output ?? '').split('\n').filter(Boolean)) {
                const index = line[0];
                const workTree = line[1];
                const path = line.slice(3);

                if (
                    index === 'U' ||
                    workTree === 'U' ||
                    (index === 'A' && workTree === 'A') ||
                    (index === 'D' && workTree === 'D')
                ) {
                    conflicted.push(path);
                } else {
                    if (index !== ' ' && index !== '?') {
                        staged.push(path);
                    }
                    if (workTree !== ' ') {
                        unstaged.push(path);
                    }
                }
            }

            return { staged, unstaged, conflicted, error: null };
        } catch (error) {
            return {
                staged: [],
                unstaged: [],
                conflicted: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }),

    /**
     * Read a file from the repository.
     */
    readFile: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                path: z.string(),
            })
        )
        .query(async ({ input }) => {
            try {
                const safePath = resolveRepoPath(input.repo, validateGitPath(input.path));
                const fs = await import('fs');
                if (!(await fileExists(safePath))) {
                    return { content: '', error: null };
                }

                const content = await fs.promises.readFile(safePath, 'utf-8');
                return { content, error: null };
            } catch (error) {
                return { content: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Read conflict-side versions for a conflicted file from git index stages.
     */
    readConflictFile: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                path: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { ours: null, base: null, theirs: null, warnings: null, error: initError };

            try {
                const gitService = getGitService();
                const safePath = validateGitPath(input.path);
                const fetchConflictVersion = (stage: number) =>
                    gitService.runGitCommandWithOutput(['show', `:${String(stage)}:${safePath}`], input.repo);
                const stageResults = await Promise.allSettled([
                    fetchConflictVersion(2),
                    fetchConflictVersion(1),
                    fetchConflictVersion(3),
                ]);

                const values = {
                    ours: null as string | null,
                    base: null as string | null,
                    theirs: null as string | null,
                };
                const warnings: string[] = [];

                if (stageResults[0].status === 'fulfilled') {
                    values.ours = stageResults[0].value;
                } else {
                    warnings.push('Unable to read our conflict version from index.');
                }

                if (stageResults[1].status === 'fulfilled') {
                    values.base = stageResults[1].value;
                } else {
                    warnings.push('Unable to read base conflict version from index.');
                }

                if (stageResults[2].status === 'fulfilled') {
                    values.theirs = stageResults[2].value;
                } else {
                    warnings.push('Unable to read theirs conflict version from index.');
                }

                const criticalError =
                    !values.ours && !values.theirs ? 'Unable to read conflict versions for this file.' : null;

                return {
                    ...values,
                    warnings: warnings.length ? warnings : null,
                    error: criticalError,
                };
            } catch (error) {
                return {
                    ours: null,
                    base: null,
                    theirs: null,
                    warnings: null,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    /**
     * Write resolved file content.
     */
    writeFile: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                path: z.string(),
                content: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const safePath = resolveRepoPath(input.repo, validateGitPath(input.path));
                const fs = await import('fs');
                await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
                await fs.promises.writeFile(safePath, input.content, 'utf-8');
                return { error: null };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * LFS operations.
     */
    lfs: router({
        status: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) {
                return {
                    installed: false,
                    tracking: [],
                    trackingPatterns: [],
                    trackedFiles: [],
                    summary: {
                        trackedPatternCount: 0,
                        trackedFileCount: 0,
                        knownSizeFileCount: 0,
                        unknownSizeFileCount: 0,
                        totalSizeBytes: null,
                        totalSizeLabel: null,
                    },
                    error: initError,
                };
            }

            try {
                const gitService = getGitService();
                await gitService.runGitCommandWithOutput(['lfs', 'version'], input.repo);

                const trackOutput = await gitService.runGitCommandWithOutput(['lfs', 'track'], input.repo);
                let lsFilesOutput: string | null;
                try {
                    lsFilesOutput = await gitService.runGitCommandWithOutput(
                        ['lfs', 'ls-files', '--long', '--size'],
                        input.repo
                    );
                } catch {
                    lsFilesOutput = await gitService.runGitCommandWithOutput(['lfs', 'ls-files', '--long'], input.repo);
                }

                const trackingPatterns = parseLfsTrackPatterns(trackOutput);
                const trackedFiles = parseLfsTrackedFiles(lsFilesOutput);
                const knownSizes = trackedFiles
                    .map((entry) => entry.sizeBytes)
                    .filter((value): value is number => value !== null);
                const totalSizeBytes = knownSizes.length ? knownSizes.reduce((sum, value) => sum + value, 0) : null;

                return {
                    installed: true,
                    tracking: trackingPatterns,
                    trackingPatterns,
                    trackedFiles,
                    summary: {
                        trackedPatternCount: trackingPatterns.length,
                        trackedFileCount: trackedFiles.length,
                        knownSizeFileCount: knownSizes.length,
                        unknownSizeFileCount: trackedFiles.length - knownSizes.length,
                        totalSizeBytes,
                        totalSizeLabel: formatByteSize(totalSizeBytes),
                    },
                    error: null,
                };
            } catch {
                return {
                    installed: false,
                    tracking: [],
                    trackingPatterns: [],
                    trackedFiles: [],
                    summary: {
                        trackedPatternCount: 0,
                        trackedFileCount: 0,
                        knownSizeFileCount: 0,
                        unknownSizeFileCount: 0,
                        totalSizeBytes: null,
                        totalSizeLabel: null,
                    },
                    error: null,
                };
            }
        }),

        track: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    pattern: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(['lfs', 'track', input.pattern], input.repo);
                return { error };
            }),

        untrack: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    pattern: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await getGitService().runGitCommand(['lfs', 'untrack', input.pattern], input.repo);
                return { error };
            }),

        pull: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(['lfs', 'pull'], input.repo);
            return { error };
        }),

        push: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(['lfs', 'push', '--all', 'origin'], input.repo);
            return { error };
        }),

        prune: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(['lfs', 'prune'], input.repo);
            return { error };
        }),
    }),

    /**
     * Launch external diff tool.
     */
    launchDiffTool: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                filePath: z.string(),
                oldHash: z.string().optional(),
                newHash: z.string().optional(),
                tool: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            try {
                const gitService = getGitService();

                // Set diff tool if specified
                if (input.tool) {
                    await gitService.runGitCommand(['config', 'diff.guitool', input.tool], input.repo);
                }

                // Build difftool command
                const args = ['difftool', '--gui'];

                if (input.oldHash && input.newHash) {
                    args.push(input.oldHash, input.newHash, '--', input.filePath);
                } else if (input.oldHash) {
                    args.push(input.oldHash, '--', input.filePath);
                } else {
                    args.push('--', input.filePath);
                }

                // Run without waiting (it opens a GUI)
                const { spawn } = await import('child_process');
                const executable = getGitService().getGitExecutable();

                if (!executable) {
                    return { error: 'Git not initialized' };
                }

                spawn(executable.path, args, {
                    cwd: input.repo,
                    detached: true,
                    stdio: 'ignore',
                }).unref();

                return { error: null };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Get configured diff tool.
     */
    getDiffTool: publicProcedure.input(z.object({ repo: z.string().optional() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { tool: null, error: initError };

        try {
            const gitService = getGitService();
            const tool = await gitService.runGitCommandWithOutput(
                ['config', '--get', 'diff.guitool'],
                input.repo ?? process.cwd()
            );
            return { tool: tool?.trim() ?? null, error: null };
        } catch {
            return { tool: null, error: null };
        }
    }),

    /**
     * Set configured diff tool.
     */
    setDiffTool: publicProcedure
        .input(
            z.object({
                repo: z.string().optional(),
                tool: z.string(),
                global: z.boolean().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['config'];
            if (input.global) args.push('--global');
            args.push('diff.guitool', input.tool);

            const error = await getGitService().runGitCommand(args, input.repo ?? process.cwd());
            return { error };
        }),

    /**
     * Commit signing operations.
     */
    signing: router({
        status: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError)
                return {
                    enabled: false,
                    method: null,
                    key: null,
                    gpgProgram: null,
                    gpgKeys: [],
                    sshKeys: [],
                    allowedSignersFile: null,
                    error: initError,
                };

            try {
                const snapshot = await readSigningStatusSnapshot(input.repo);

                return {
                    ...snapshot,
                    error: null,
                };
            } catch (error) {
                return {
                    enabled: false,
                    method: null,
                    key: null,
                    gpgProgram: null,
                    gpgKeys: [],
                    sshKeys: [],
                    allowedSignersFile: null,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

        configure: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    enabled: z.boolean(),
                    method: z.enum(['gpg', 'ssh']).optional(),
                    key: z.string().optional(),
                    gpgProgram: z.string().optional(),
                    allowedSignersFile: z.string().optional(),
                    global: z.boolean().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const error = await applySigningConfig({
                    repo: input.repo,
                    enabled: input.enabled,
                    ...withDefinedProps({
                        method: input.method,
                        key: input.key,
                        gpgProgram: input.gpgProgram,
                        allowedSignersFile: input.allowedSignersFile,
                        global: input.global,
                    }),
                });
                return { error };
            }),
    }),

    // ==================== Ahead/Behind ====================

    /**
     * Get ahead/behind counts for branches compared to their upstream.
     */
    aheadBehind: publicProcedure
        .input(z.object({ repo: z.string(), branch: z.string().optional() }))
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { ahead: 0, behind: 0, error: initError };

            try {
                const gitService = getGitService();
                const branch = input.branch || 'HEAD';
                const output = await gitService.runGitCommandWithOutput(
                    ['rev-list', '--left-right', '--count', `${branch}...@{upstream}`],
                    input.repo
                );

                const match = output?.match(/^(\d+)\s+(\d+)/);
                if (match) {
                    return {
                        ahead: parseInt(match[1] ?? '0', 10),
                        behind: parseInt(match[2] ?? '0', 10),
                        error: null,
                    };
                }
                return { ahead: 0, behind: 0, error: null };
            } catch {
                // No upstream set
                return { ahead: 0, behind: 0, error: null };
            }
        }),

    /**
     * Get ahead/behind for all local branches.
     */
    aheadBehindAll: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { branches: [], error: initError };

        try {
            const gitService = getGitService();
            const output = await gitService.runGitCommandWithOutput(
                ['for-each-ref', '--format=%(refname:short) %(upstream:short)', 'refs/heads/'],
                input.repo
            );

            const branches: Array<{ branch: string; ahead: number; behind: number; upstream: string | null }> = [];
            const lines = (output ?? '').split('\n').filter(Boolean);

            for (const line of lines) {
                const [branch, upstream] = line.split(' ');
                if (!branch) continue;

                if (upstream) {
                    try {
                        const countOutput = await gitService.runGitCommandWithOutput(
                            ['rev-list', '--left-right', '--count', `${branch}...${upstream}`],
                            input.repo
                        );
                        const match = countOutput?.match(/^(\d+)\s+(\d+)/);
                        branches.push({
                            branch,
                            ahead: match ? parseInt(match[1] ?? '0', 10) : 0,
                            behind: match ? parseInt(match[2] ?? '0', 10) : 0,
                            upstream,
                        });
                    } catch {
                        branches.push({ branch, ahead: 0, behind: 0, upstream });
                    }
                } else {
                    branches.push({ branch, ahead: 0, behind: 0, upstream: null });
                }
            }

            return { branches, error: null };
        } catch (error) {
            return { branches: [], error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    // ==================== Undo ====================

    /**
     * Undo last commit (soft reset to keep changes staged).
     */
    undoLastCommit: publicProcedure
        .input(z.object({ repo: z.string(), soft: z.boolean().optional() }))
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const gitService = getGitService();
            const mode = input.soft !== false ? '--soft' : '--mixed';
            const error = await gitService.runGitCommand(['reset', mode, 'HEAD~1'], input.repo);
            return { error };
        }),

    // ==================== Preview Operations ====================

    /**
     * Preview a rebase - shows what commits will be affected.
     */
    rebasePreview: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                branch: z.string(),
                onto: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { commits: [], error: initError, warnings: [] };

            try {
                const gitService = getGitService();

                // Get commits that will be rebased
                const logResult = await gitService.runGitCommandWithOutput(
                    ['log', '--format=%H|%h|%s', `${input.onto}..${input.branch}`],
                    input.repo
                );
                const commits = (logResult ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const [hash, shortHash, ...msgParts] = line.split('|');
                        return { hash, shortHash, message: msgParts.join('|') };
                    });

                return {
                    commits,
                    willRewriteHistory: true,
                    willForcePush: true,
                    warnings: ['This will rewrite history. A force push may be required.'],
                };
            } catch (error) {
                return {
                    commits: [],
                    error: error instanceof Error ? error.message : 'Unknown error',
                    warnings: ['Could not preview rebase'],
                };
            }
        }),

    /**
     * Compare two commit ranges using git range-diff.
     */
    rangeDiff: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                range1: z.string(),
                range2: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { diff: [], error: initError };

            try {
                const gitService = getGitService();
                const output = await gitService.runGitCommandWithOutput(
                    ['range-diff', input.range1, input.range2, '--format=plain'],
                    input.repo
                );

                const diff = (output ?? '').split('\n').filter(Boolean);
                return { diff, error: null };
            } catch (error) {
                return { diff: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Get operation history (reflog) with undo capability.
     */
    operationHistory: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                limit: z.number().optional().default(20),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { operations: [], error: initError };

            try {
                const gitService = getGitService();
                const output = await gitService.runGitCommandWithOutput(
                    ['reflog', `--format=%H|%gd|%gs|%ci`, `-n=${String(input.limit)}`],
                    input.repo
                );

                const operations = (output ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const [hash = '', ref = '', action = '', date = ''] = line.split('|');
                        return {
                            id: hash,
                            ref,
                            action,
                            date,
                            canUndo: false,
                            undoSupported: false,
                            undoReason:
                                'Reflog-based undo is disabled because it can discard worktree state. Use explicit undo-safe operations instead.',
                        };
                    });

                return { operations, error: null };
            } catch (error) {
                return { operations: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Undo a Git operation using reflog.
     */
    undoOperation: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                ref: z.string(),
                targetHash: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError, success: false };

            try {
                void input;
                return {
                    error: 'Unsafe reflog undo has been disabled. Use the operation timeline or explicit Git commands for recovery.',
                    success: false,
                };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error', success: false };
            }
        }),

    /**
     * Get diff stats between two commits.
     */
    diffStats: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                from: z.string(),
                to: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { stats: null, error: initError };

            try {
                const gitService = getGitService();
                const output = await gitService.runGitCommandWithOutput(
                    ['diff', '--stat', '--numstat', `${input.from}..${input.to}`],
                    input.repo
                );

                const files = (output ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const [additions, deletions, path] = line.split('\t');
                        return {
                            path: path ?? '',
                            additions: parseInt(additions ?? '0', 10) || 0,
                            deletions: parseInt(deletions ?? '0', 10) || 0,
                        };
                    });

                const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
                const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

                return {
                    stats: {
                        files: files.length,
                        additions: totalAdditions,
                        deletions: totalDeletions,
                        filesList: files,
                    },
                    error: null,
                };
            } catch (error) {
                return { stats: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Get branches that would be affected by a rebase/merge.
     */
    potentiallyAffectedBranches: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                sourceBranch: z.string(),
                targetBranch: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { branches: [], error: initError };

            try {
                const gitService = getGitService();
                const output = await gitService.runGitCommandWithOutput(
                    ['branch', '--format=%(refname:short)', `--contains=${input.sourceBranch}`],
                    input.repo
                );

                const branches = (output ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((b) => b.trim())
                    .filter((b) => b && b !== input.targetBranch);

                return { branches, error: null };
            } catch (error) {
                return { branches: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    // ==================== Git Flow ====================

    gitflow: router({
        init: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    master: z.string().optional(),
                    develop: z.string().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                const gitService = getGitService();
                const args = ['flow', 'init'];
                if (input.master) args.push('-m', input.master);
                if (input.develop) args.push('-d', input.develop);
                else args.push('-d'); // Use defaults

                const error = await gitService.runGitCommand(args, input.repo);
                return { error };
            }),

        feature: router({
            start: publicProcedure
                .input(z.object({ repo: z.string(), name: z.string() }))
                .mutation(async ({ input }) => {
                    const initError = await ensureGitInitialized();
                    if (initError) return { error: initError };

                    const gitService = getGitService();
                    const error = await gitService.runGitCommand(['flow', 'feature', 'start', input.name], input.repo);
                    return { error };
                }),

            finish: publicProcedure
                .input(z.object({ repo: z.string(), name: z.string() }))
                .mutation(async ({ input }) => {
                    const initError = await ensureGitInitialized();
                    if (initError) return { error: initError };

                    const gitService = getGitService();
                    const error = await gitService.runGitCommand(['flow', 'feature', 'finish', input.name], input.repo);
                    return { error };
                }),
        }),

        release: router({
            start: publicProcedure
                .input(z.object({ repo: z.string(), name: z.string() }))
                .mutation(async ({ input }) => {
                    const initError = await ensureGitInitialized();
                    if (initError) return { error: initError };

                    const gitService = getGitService();
                    const error = await gitService.runGitCommand(['flow', 'release', 'start', input.name], input.repo);
                    return { error };
                }),

            finish: publicProcedure
                .input(z.object({ repo: z.string(), name: z.string(), tag: z.string().optional() }))
                .mutation(async ({ input }) => {
                    const initError = await ensureGitInitialized();
                    if (initError) return { error: initError };

                    const gitService = getGitService();
                    const args = ['flow', 'release', 'finish', input.name];
                    if (input.tag) args.push('-m', input.tag);
                    const error = await gitService.runGitCommand(args, input.repo);
                    return { error };
                }),
        }),

        hotfix: router({
            start: publicProcedure
                .input(z.object({ repo: z.string(), name: z.string() }))
                .mutation(async ({ input }) => {
                    const initError = await ensureGitInitialized();
                    if (initError) return { error: initError };

                    const gitService = getGitService();
                    const error = await gitService.runGitCommand(['flow', 'hotfix', 'start', input.name], input.repo);
                    return { error };
                }),

            finish: publicProcedure
                .input(z.object({ repo: z.string(), name: z.string(), tag: z.string().optional() }))
                .mutation(async ({ input }) => {
                    const initError = await ensureGitInitialized();
                    if (initError) return { error: initError };

                    const gitService = getGitService();
                    const args = ['flow', 'hotfix', 'finish', input.name];
                    if (input.tag) args.push('-m', input.tag);
                    const error = await gitService.runGitCommand(args, input.repo);
                    return { error };
                }),
        }),
    }),

    // ==================== Branch Compare ====================

    compareBranches: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                from: z.string(),
                to: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { commits: [], files: [], error: initError };

            try {
                const gitService = getGitService();

                // Get commits diff
                const commitsOutput = await gitService.runGitCommandWithOutput(
                    ['log', `${input.from}..${input.to}`, '--oneline', '--no-decorate'],
                    input.repo
                );

                const commits = (commitsOutput ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const [hash, ...msgParts] = line.split(' ');
                        return { hash: hash ?? '', message: msgParts.join(' ') };
                    });

                // Get files changed
                const filesOutput = await gitService.runGitCommandWithOutput(
                    ['diff', '--name-status', input.from, input.to],
                    input.repo
                );

                const files = (filesOutput ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const [status, ...pathParts] = line.split('\t');
                        return { status: status ?? '', path: pathParts.join('\t') };
                    });

                // Get stats
                const statsOutput = await gitService.runGitCommandWithOutput(
                    ['diff', '--shortstat', input.from, input.to],
                    input.repo
                );

                let additions = 0;
                let deletions = 0;
                // eslint-disable-next-line security/detect-unsafe-regex
                const statsMatch = statsOutput?.match(/(\d+) insertion[^,]*(?:,\s*(\d+) deletion)?/);
                if (statsMatch) {
                    additions = parseInt(statsMatch[1] ?? '0', 10);
                    deletions = statsMatch[2] ? parseInt(statsMatch[2], 10) : 0;
                }

                return { commits, files, additions, deletions, error: null };
            } catch (error) {
                return {
                    commits: [],
                    files: [],
                    additions: 0,
                    deletions: 0,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    // ==================== Fuzzy Finder ====================

    searchRefs: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                query: z.string(),
                includeCommits: z.boolean().optional(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { branches: [], tags: [], commits: [], error: initError };

            try {
                const gitService = getGitService();
                const query = input.query.toLowerCase();

                // Search branches
                const branchesOutput = await gitService.runGitCommandWithOutput(
                    ['branch', '-a', '--list', `*${input.query}*`],
                    input.repo
                );
                const branches = (branchesOutput ?? '')
                    .split('\n')
                    .map((l) => l.replace(/^\*?\s*/, '').trim())
                    .filter((l) => l && l.toLowerCase().includes(query));

                // Search tags
                const tagsOutput = await gitService.runGitCommandWithOutput(
                    ['tag', '-l', `*${input.query}*`],
                    input.repo
                );
                const tags = (tagsOutput ?? '').split('\n').filter((l) => l && l.toLowerCase().includes(query));

                // Search recent commits
                let commits: Array<{ hash: string; message: string; date: string }> = [];
                if (input.includeCommits) {
                    const commitsOutput = await gitService.runGitCommandWithOutput(
                        ['log', '--oneline', '-50', '--all', '--grep', input.query],
                        input.repo
                    );
                    commits = (commitsOutput ?? '')
                        .split('\n')
                        .filter(Boolean)
                        .map((line) => {
                            const [hash, ...msgParts] = line.split(' ');
                            return { hash: hash ?? '', message: msgParts.join(' '), date: '' };
                        });
                }

                return { branches, tags, commits, error: null };
            } catch (error) {
                return {
                    branches: [],
                    tags: [],
                    commits: [],
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    // ==================== Statistics ====================

    statistics: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                since: z.string().optional(),
                until: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { authors: [], totalCommits: 0, error: initError };

            try {
                const gitService = getGitService();
                const args = ['shortlog', '-sne', '--all'];
                if (input.since) args.push('--since', input.since);
                if (input.until) args.push('--until', input.until);

                const output = await gitService.runGitCommandWithOutput(args, input.repo);

                let totalCommits = 0;
                const authors: Array<{ name: string; email: string; commits: number }> = [];

                (output ?? '')
                    .split('\n')
                    .filter(Boolean)
                    .forEach((line) => {
                        const match = line.match(/^\s*(\d+)\s+(.+)\s+<(.+)>$/);
                        if (match) {
                            const commits = parseInt(match[1] ?? '0', 10);
                            totalCommits += commits;
                            authors.push({
                                commits,
                                name: (match[2] ?? '').trim(),
                                email: match[3] ?? '',
                            });
                        }
                    });

                // Sort by commits descending
                authors.sort((a, b) => b.commits - a.commits);

                return { authors, totalCommits, error: null };
            } catch (error) {
                return {
                    authors: [],
                    totalCommits: 0,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    insights: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                since: z.string().optional(),
                until: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) {
                return {
                    summary: null,
                    activity: [] as Array<{ date: string; commits: number }>,
                    hotspots: [] as Array<{ path: string; touches: number; additions: number; deletions: number }>,
                    error: initError,
                };
            }

            try {
                const gitService = getGitService();
                const args = ['log', '--all', '--numstat', '--date=short', '--pretty=format:__GG__|%H|%an|%ad|%s'];
                if (input.since) args.push('--since', input.since);
                if (input.until) args.push('--until', input.until);

                const output = await gitService.runGitCommandWithOutput(args, input.repo);
                const lines = (output ?? '').split('\n');
                const dailyCommits = new Map<string, number>();
                const authorCommits = new Map<string, number>();
                const hotspots = new Map<string, { path: string; touches: number; additions: number; deletions: number }>();
                let totalCommits = 0;
                let mergeCommits = 0;
                let revertCommits = 0;
                let totalAdditions = 0;
                let totalDeletions = 0;

                for (const rawLine of lines) {
                    const line = rawLine.trimEnd();
                    if (!line) {
                        continue;
                    }
                    if (line.startsWith('__GG__|')) {
                        const [, hash, author, date, subject] = line.split('|');
                        void hash;
                        totalCommits += 1;
                        if (date) {
                            dailyCommits.set(date, (dailyCommits.get(date) ?? 0) + 1);
                        }
                        if (author) {
                            authorCommits.set(author, (authorCommits.get(author) ?? 0) + 1);
                        }
                        const normalizedSubject = (subject ?? '').toLowerCase();
                        if (normalizedSubject.startsWith('merge ')) {
                            mergeCommits += 1;
                        }
                        if (normalizedSubject.startsWith('revert') || normalizedSubject.includes('rollback')) {
                            revertCommits += 1;
                        }
                        continue;
                    }

                    const [addedRaw, deletedRaw, filePath] = line.split('\t');
                    if (!filePath) {
                        continue;
                    }
                    const additions = addedRaw === '-' ? 0 : Number.parseInt(addedRaw ?? '0', 10);
                    const deletions = deletedRaw === '-' ? 0 : Number.parseInt(deletedRaw ?? '0', 10);
                    totalAdditions += Number.isFinite(additions) ? additions : 0;
                    totalDeletions += Number.isFinite(deletions) ? deletions : 0;
                    const current = hotspots.get(filePath) ?? {
                        path: filePath,
                        touches: 0,
                        additions: 0,
                        deletions: 0,
                    };
                    current.touches += 1;
                    current.additions += Number.isFinite(additions) ? additions : 0;
                    current.deletions += Number.isFinite(deletions) ? deletions : 0;
                    hotspots.set(filePath, current);
                }

                const activity = Array.from(dailyCommits.entries())
                    .sort(([left], [right]) => left.localeCompare(right))
                    .map(([date, commits]) => ({ date, commits }));
                const hotspotList = Array.from(hotspots.values())
                    .sort((left, right) => right.touches - left.touches || right.additions - left.additions)
                    .slice(0, 12);
                const authorCounts = Array.from(authorCommits.values()).sort((left, right) => right - left);
                const topAuthorCommits = authorCounts[0] ?? 0;
                const activeDays = activity.filter((day) => day.commits > 0).length;
                const busiestDay = activity.reduce(
                    (best, day) => (day.commits > best.commits ? day : best),
                    { date: '', commits: 0 }
                );
                const midpoint = Math.max(1, Math.floor(activity.length / 2));
                const previousWindow = activity.slice(0, midpoint).reduce((sum, day) => sum + day.commits, 0);
                const currentWindow = activity.slice(midpoint).reduce((sum, day) => sum + day.commits, 0);
                const velocityDeltaPct =
                    previousWindow > 0 ? Math.round(((currentWindow - previousWindow) / previousWindow) * 100) : 0;

                return {
                    summary: {
                        totalCommits,
                        activeDays,
                        mergeCommits,
                        revertCommits,
                        totalAdditions,
                        totalDeletions,
                        hotspotCount: hotspotList.length,
                        topAuthorSharePct: totalCommits > 0 ? Math.round((topAuthorCommits / totalCommits) * 100) : 0,
                        avgCommitsPerActiveDay:
                            activeDays > 0 ? Number((totalCommits / activeDays).toFixed(1)) : 0,
                        busiestDay,
                        velocityDeltaPct,
                    },
                    activity,
                    hotspots: hotspotList,
                    error: null,
                };
            } catch (error) {
                return {
                    summary: null,
                    activity: [] as Array<{ date: string; commits: number }>,
                    hotspots: [] as Array<{ path: string; touches: number; additions: number; deletions: number }>,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    // ==================== Signing ====================
    getSigningConfig: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError)
            return {
                enabled: false,
                method: null,
                key: null,
                gpgProgram: null,
                sshKeys: [],
                allowedSignersFile: null,
                error: initError,
            };

        try {
            const snapshot = await readSigningStatusSnapshot(input.repo, { includeGpgKeys: false });

            return {
                enabled: snapshot.enabled,
                method: snapshot.method,
                key: snapshot.key,
                gpgProgram: snapshot.gpgProgram,
                sshKeys: snapshot.sshKeys,
                allowedSignersFile: snapshot.allowedSignersFile,
                error: null,
            };
        } catch (error) {
            return {
                enabled: false,
                method: null,
                key: null,
                gpgProgram: null,
                sshKeys: [],
                allowedSignersFile: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }),

    setSigningConfig: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                enabled: z.boolean(),
                method: z.enum(['gpg', 'ssh']),
                key: z.string().optional(),
                gpgProgram: z.string().optional(),
                allowedSignersFile: z.string().optional(),
                global: z.boolean().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            try {
                const error = await applySigningConfig({
                    repo: input.repo,
                    enabled: input.enabled,
                    method: input.method,
                    ...withDefinedProps({
                        key: input.key,
                        gpgProgram: input.gpgProgram,
                        allowedSignersFile: input.allowedSignersFile,
                        global: input.global,
                    }),
                });
                return { error };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    // ==================== Hooks ====================

    hooks: router({
        list: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { hooks: [], error: initError };

            try {
                const gitDir = await getGitDir(input.repo);
                if (!gitDir) return { hooks: [], error: 'Could not find .git directory' };
                const hooksDir = path.join(gitDir, 'hooks');
                if (!(await fileExists(hooksDir))) {
                    return { hooks: [], error: null };
                }

                const hookNames = [
                    'pre-commit',
                    'prepare-commit-msg',
                    'commit-msg',
                    'post-commit',
                    'pre-push',
                    'pre-rebase',
                    'post-merge',
                    'pre-receive',
                    'update',
                    'post-receive',
                    'post-update',
                    'push-to-checkout',
                    'pre-auto-gc',
                    'post-rewrite',
                    'sendemail-validate',
                ];

                // eslint-disable-next-line security/detect-non-literal-fs-filename
                const entries = await fs.readdir(hooksDir, { withFileTypes: true });
                const discovered = new Map<
                    string,
                    { enabled: boolean; executable: boolean; source: 'hook' | 'sample' | 'generated'; path: string }
                >();

                for (const entry of entries) {
                    if (!entry.isFile()) continue;
                    if (entry.name.startsWith('.')) continue;

                    const baseName = entry.name.endsWith('.sample')
                        ? entry.name.slice(0, -'.sample'.length)
                        : entry.name;
                    if (!baseName) continue;

                    const entryPath = path.join(hooksDir, entry.name);
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    const stat = await fs.stat(entryPath);
                    const executable = (stat.mode & 0o111) !== 0;

                    if (entry.name.endsWith('.sample')) {
                        if (!discovered.has(baseName)) {
                            discovered.set(baseName, {
                                enabled: false,
                                executable,
                                source: 'sample',
                                path: entryPath,
                            });
                        }
                        continue;
                    }

                    discovered.set(baseName, {
                        enabled: true,
                        executable,
                        source: 'hook',
                        path: entryPath,
                    });
                }

                const hooks: Array<{
                    name: string;
                    enabled: boolean;
                    executable: boolean;
                    source: 'hook' | 'sample' | 'generated';
                    path: string;
                }> = [];

                for (const name of hookNames) {
                    const existing = discovered.get(name);
                    if (existing) {
                        hooks.push({
                            name,
                            enabled: existing.enabled,
                            executable: existing.executable,
                            source: existing.source,
                            path: existing.path,
                        });
                        discovered.delete(name);
                    }
                }

                for (const [name, existing] of [...discovered.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
                    hooks.push({
                        name,
                        enabled: existing.enabled,
                        executable: existing.executable,
                        source: existing.source,
                        path: existing.path,
                    });
                }

                return { hooks, error: null };
            } catch (error) {
                return { hooks: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

        toggle: publicProcedure
            .input(z.object({ repo: z.string(), name: z.string(), enabled: z.boolean() }))
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { error: initError };

                try {
                    const gitDir = await getGitDir(input.repo);
                    if (!gitDir) {
                        return { error: 'Could not find .git directory' };
                    }
                    const hooksDir = path.join(gitDir, 'hooks');
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    await fs.mkdir(hooksDir, { recursive: true });

                    const hookPath = path.join(hooksDir, input.name);
                    const samplePath = `${hookPath}.sample`;

                    if (input.enabled) {
                        if (await fileExists(samplePath)) {
                            if (await fileExists(hookPath)) {
                                // eslint-disable-next-line security/detect-non-literal-fs-filename
                                await fs.unlink(hookPath);
                            }
                            // eslint-disable-next-line security/detect-non-literal-fs-filename
                            await fs.rename(samplePath, hookPath);
                        } else if (!(await fileExists(hookPath))) {
                            // eslint-disable-next-line security/detect-non-literal-fs-filename
                            await fs.writeFile(
                                hookPath,
                                '#!/usr/bin/env sh\n# Generated by Git Graph\nexit 0\n',
                                'utf8'
                            );
                        }

                        try {
                            // eslint-disable-next-line security/detect-non-literal-fs-filename
                            await fs.chmod(hookPath, 0o755);
                        } catch {
                            // chmod can fail on some platforms/filesystems, but the hook was still enabled.
                        }
                    } else if (await fileExists(hookPath)) {
                        if (await fileExists(samplePath)) {
                            // eslint-disable-next-line security/detect-non-literal-fs-filename
                            await fs.unlink(samplePath);
                        }
                        // eslint-disable-next-line security/detect-non-literal-fs-filename
                        await fs.rename(hookPath, samplePath);
                    }

                    return { error: null };
                } catch (error) {
                    return { error: error instanceof Error ? error.message : 'Unknown error' };
                }
            }),
    }),

    // ==================== Workflow Engine ====================

    workflow: router({
        list: publicProcedure.query(() => {
            const definitions = getWorkflowDefinitions();
            const runs = instanceStore.get('workflowRuns');
            return {
                definitions,
                runs: Array.isArray(runs) ? runs : [],
                error: null,
            };
        }),

        create: publicProcedure
            .input(
                z.object({
                    name: z.string().min(1),
                    trigger: workflowTriggerSchema.default('manual'),
                    steps: z.array(workflowStepSchema).min(1),
                    inputs: z.array(workflowInputSchema).optional(),
                    guards: z.array(workflowGuardSchema).optional(),
                    onFailure: z.enum(['stop', 'continue', 'rollback']).optional(),
                })
            )
            .mutation(({ input }) => {
                const now = Date.now();
                const definition: WorkflowDefinition = {
                    id: `wf-${randomUUID()}`,
                    name: input.name.trim(),
                    trigger: input.trigger,
                    steps: input.steps,
                    inputs: input.inputs ?? [],
                    guards: input.guards ?? [],
                    onFailure: input.onFailure ?? 'stop',
                    createdAt: now,
                    updatedAt: now,
                };
                const existing = getWorkflowDefinitions();
                setWorkflowDefinitions([...existing, definition]);
                return { workflow: definition, error: null };
            }),

        update: publicProcedure
            .input(
                z.object({
                    id: z.string().min(1),
                    name: z.string().min(1).optional(),
                    trigger: workflowTriggerSchema.optional(),
                    steps: z.array(workflowStepSchema).optional(),
                    inputs: z.array(workflowInputSchema).optional(),
                    guards: z.array(workflowGuardSchema).optional(),
                    onFailure: z.enum(['stop', 'continue', 'rollback']).optional(),
                })
            )
            .mutation(({ input }) => {
                const definitions = getWorkflowDefinitions();
                const current = definitions.find((entry) => entry.id === input.id);
                if (!current) {
                    return { workflow: null, error: 'Workflow not found.' };
                }

                const updated: WorkflowDefinition = {
                    ...current,
                    ...(input.name !== undefined ? { name: input.name } : {}),
                    ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
                    ...(input.steps !== undefined ? { steps: input.steps } : {}),
                    ...(input.inputs !== undefined ? { inputs: input.inputs } : {}),
                    ...(input.guards !== undefined ? { guards: input.guards } : {}),
                    ...(input.onFailure !== undefined ? { onFailure: input.onFailure } : {}),
                    id: current.id,
                    createdAt: current.createdAt,
                    updatedAt: Date.now(),
                };

                setWorkflowDefinitions(definitions.map((entry) => (entry.id === updated.id ? updated : entry)));
                return { workflow: updated, error: null };
            }),

        delete: publicProcedure
            .input(
                z.object({
                    id: z.string().min(1),
                })
            )
            .mutation(({ input }) => {
                const definitions = getWorkflowDefinitions();
                const nextDefinitions = definitions.filter((entry) => entry.id !== input.id);
                if (nextDefinitions.length === definitions.length) {
                    return { success: false, error: 'Workflow not found.' };
                }
                setWorkflowDefinitions(nextDefinitions);
                return { success: true, error: null };
            }),

        dryRun: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    workflowId: z.string().min(1),
                    inputs: z.record(z.string(), z.string()).optional(),
                })
            )
            .query(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { graph: { nodes: [], edges: [] }, warnings: [initError], error: initError };

                const workflow = getWorkflowDefinitions().find((entry) => entry.id === input.workflowId);
                if (!workflow) {
                    return { graph: { nodes: [], edges: [] }, warnings: [], error: 'Workflow not found.' };
                }

                const warnings: string[] = [];
                const statusOutput = await getGitService().runGitCommandWithOutput(['status', '--porcelain'], input.repo);
                const currentBranch =
                    (await getGitService().runGitCommandWithOutput(['branch', '--show-current'], input.repo))?.trim() ??
                    '';

                for (const guard of workflow.guards) {
                    if (guard.type === 'cleanWorkingTree' && (statusOutput ?? '').trim().length > 0) {
                        warnings.push('Guard `cleanWorkingTree` will fail because repository has local changes.');
                    } else if (
                        guard.type === 'branchMatches' &&
                        guard.value &&
                        currentBranch &&
                        // eslint-disable-next-line security/detect-non-literal-regexp
                        !new RegExp(guard.value).test(currentBranch)
                    ) {
                        warnings.push(
                            `Guard \`branchMatches\` expects ${guard.value} but current branch is ${currentBranch}.`
                        );
                    } else if (guard.type === 'hasUpstream') {
                        const upstream = await getGitService().runGitCommandWithOutput(
                            ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
                            input.repo
                        );
                        if (!(upstream ?? '').trim()) {
                            warnings.push('Guard `hasUpstream` will fail because no upstream is configured.');
                        }
                    }
                }

                const graph = {
                    nodes: workflow.steps.map((step, index) => ({
                        id: step.id,
                        type: step.type,
                        label: `${String(index + 1)}. ${step.type}`,
                        params: step.params,
                    })),
                    edges: workflow.steps
                        .slice(0, -1)
                        .map((step, index) => ({
                            from: step.id,
                            to: workflow.steps[index + 1]?.id ?? step.id,
                        })),
                };

                return {
                    graph,
                    warnings,
                    error: null,
                };
            }),

        execute: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    workflowId: z.string().min(1),
                    inputs: z.record(z.string(), z.string()).optional(),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) {
                    return {
                        run: null,
                        error: initError,
                    };
                }

                const workflow = getWorkflowDefinitions().find((entry) => entry.id === input.workflowId);
                if (!workflow) {
                    return { run: null, error: 'Workflow not found.' };
                }

                const resolveTemplate = (value: string): string =>
                    value
                        .replace(/\$\{repo\}/g, input.repo)
                        .replace(/\$\{inputs\.([a-zA-Z0-9_-]+)\}/g, (_match, key: string) => input.inputs?.[key] ?? '');

                const run: {
                    id: string;
                    workflowId: string;
                    startedAt: number;
                    finishedAt: number | null;
                    status: 'running' | 'success' | 'failed';
                    steps: Array<{
                        id: string;
                        type: WorkflowStep['type'];
                        status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
                        message?: string;
                    }>;
                    error?: string;
                } = {
                    id: `wfr-${randomUUID()}`,
                    workflowId: workflow.id,
                    startedAt: Date.now(),
                    finishedAt: null,
                    status: 'running',
                    steps: workflow.steps.map((step) => ({
                        id: step.id,
                        type: step.type,
                        status: 'pending',
                    })),
                };

                const updateStep = (
                    stepId: string,
                    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped',
                    message?: string
                ) => {
                    run.steps = run.steps.map((entry) =>
                        entry.id === stepId
                            ? {
                                  ...entry,
                                  status,
                                  ...withDefinedProps({
                                      message: message ?? entry.message,
                                  }),
                              }
                            : entry
                    );
                };

                try {
                    for (const step of workflow.steps) {
                        updateStep(step.id, 'running');
                        const params = step.params;
                        const asString = (key: string, fallback: string = ''): string =>
                            typeof params[key] === 'string' ? resolveTemplate(params[key]) : fallback;
                        const asBool = (key: string, fallback: boolean = false): boolean =>
                            typeof params[key] === 'boolean' ? (params[key]) : fallback;

                        let stepError: string | null = null;

                        if (step.type === 'checkout') {
                            const ref = asString('ref');
                            if (!ref) {
                                stepError = 'checkout step requires params.ref';
                            } else {
                                stepError = await getGitService().runGitCommand(['checkout', ref], input.repo);
                            }
                        } else if (step.type === 'fetch') {
                            const remote = asString('remote', '--all');
                            const args = remote === '--all' ? ['fetch', '--all', '--prune'] : ['fetch', remote, '--prune'];
                            stepError = await getGitService().runGitCommand(args, input.repo);
                        } else if (step.type === 'createBranch') {
                            const name = asString('name');
                            const from = asString('from', 'HEAD');
                            if (!name) {
                                stepError = 'createBranch step requires params.name';
                            } else {
                                stepError = await getGitService().runGitCommand(['checkout', '-b', name, from], input.repo);
                            }
                        } else if (step.type === 'merge') {
                            const branch = asString('branch');
                            if (!branch) {
                                stepError = 'merge step requires params.branch';
                            } else {
                                const args = ['merge'];
                                if (asBool('noFF', true)) args.push('--no-ff');
                                if (asBool('squash', false)) args.push('--squash');
                                args.push(branch);
                                stepError = await getGitService().runGitCommand(args, input.repo);
                            }
                        } else if (step.type === 'rebase') {
                            const onto = asString('onto');
                            if (!onto) {
                                stepError = 'rebase step requires params.onto';
                            } else {
                                stepError = await getGitService().runGitCommand(['rebase', onto], input.repo);
                            }
                        } else if (step.type === 'push') {
                            const remote = asString('remote', 'origin');
                            const branch = asString('branch', 'HEAD');
                            const args = ['push', remote, branch];
                            if (asBool('force', false)) {
                                args.push('--force-with-lease');
                            }
                            stepError = await getGitService().runGitCommand(args, input.repo);
                        } else if (step.type === 'openPR') {
                            const provider = asString('provider') as PullRequestProvider;
                            const title = asString('title', `PR: ${asString('head', 'HEAD')}`);
                            const body = asString('body', '');
                            const head = asString('head', 'HEAD');
                            const base = asString('base', 'main');
                            const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                            if (!remoteUrl) {
                                stepError = 'No repository remote configured for PR creation.';
                            } else {
                                try {
                                    await createRemotePullRequest(remoteUrl, provider, getStoredProviderAuthConfig(), {
                                        title,
                                        body,
                                        head,
                                        base,
                                        draft: asBool('draft', false),
                                    });
                                } catch (error) {
                                    stepError = error instanceof Error ? error.message : 'Unable to create PR';
                                }
                            }
                        } else if (step.type === 'runHook') {
                            const command = asString('command');
                            if (!command) {
                                stepError = 'runHook step requires params.command';
                            } else {
                                const output = await getGitService().runGitCommandWithOutput(command.split(' '), input.repo);
                                if (output === null) {
                                    stepError = 'Hook command failed.';
                                }
                            }
                        } else {
                            stepError = null;
                        }

                        if (stepError) {
                            updateStep(step.id, 'failed', stepError);
                            if (workflow.onFailure === 'continue') {
                                continue;
                            }
                            if (workflow.onFailure === 'rollback') {
                                const rollbackAttempts: Array<{ name: string; error: string | null }> = [];
                                const rollbackSteps: Array<{ name: string; args: string[] }> = [
                                    { name: 'rebase --abort', args: ['rebase', '--abort'] },
                                    { name: 'merge --abort', args: ['merge', '--abort'] },
                                    { name: 'cherry-pick --abort', args: ['cherry-pick', '--abort'] },
                                    { name: 'reset --hard ORIG_HEAD', args: ['reset', '--hard', 'ORIG_HEAD'] },
                                ];

                                for (const rollbackStep of rollbackSteps) {
                                    const rollbackError = await getGitService().runGitCommand(rollbackStep.args, input.repo);
                                    rollbackAttempts.push({ name: rollbackStep.name, error: rollbackError });
                                }

                                const successful = rollbackAttempts.filter((entry) => !entry.error).map((entry) => entry.name);
                                const failed = rollbackAttempts.filter((entry) => entry.error);
                                const rollbackSummary = successful.length > 0
                                    ? `Rollback attempted: ${successful.join(', ')}`
                                    : 'Rollback attempt did not complete any recovery step';
                                const rollbackFailures =
                                    failed.length > 0
                                        ? ` | rollback warnings: ${failed.map((entry) => `${entry.name}: ${entry.error ?? ''}`).join(' ; ')}`
                                        : '';

                                run.error = `${stepError} | ${rollbackSummary}${rollbackFailures}`;
                            } else {
                                run.error = stepError;
                            }
                            run.status = 'failed';
                            break;
                        }

                        updateStep(step.id, 'success');
                    }

                    if (run.status !== 'failed') {
                        run.status = 'success';
                    }
                } catch (error) {
                    run.status = 'failed';
                    run.error = error instanceof Error ? error.message : 'Workflow execution failed';
                }

                run.finishedAt = Date.now();
                addWorkflowRun(run);
                return {
                    run,
                    error: run.error ?? null,
                };
            }),
    }),

    // ==================== Graphite / Stacked Interop ====================

    graphite: router({
        status: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
            const available = await commandExists('gt');
            if (!available) {
                return {
                    available: false,
                    version: null,
                    stack: [] as Array<{ branch: string; parent: string | null; prNumber: number | null }>,
                    fallbackMode: 'local',
                    error: null,
                };
            }

            const versionRun = await runExecutable('gt', ['--version'], input.repo);
            return {
                available: true,
                version: versionRun.stdout.trim() || null,
                stack: [] as Array<{ branch: string; parent: string | null; prNumber: number | null }>,
                fallbackMode: 'graphite',
                error: versionRun.error,
            };
        }),

        restack: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                })
            )
            .mutation(async ({ input }) => {
                const available = await commandExists('gt');
                if (!available) {
                    return {
                        success: false,
                        fallbackMode: 'local',
                        output: null,
                        error: 'Graphite CLI not available. Local stack mode is active.',
                    };
                }

                const run = await runExecutable('gt', ['restack'], input.repo);
                return {
                    success: !run.error,
                    fallbackMode: 'graphite',
                    output: run.stdout.trim() || null,
                    error: run.error,
                };
            }),

        importStack: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                })
            )
            .query(async ({ input }) => {
                const available = await commandExists('gt');
                if (!available) {
                    return { stack: [] as Array<{ branch: string; parent: string | null }>, error: null, fallbackMode: 'local' };
                }

                const run = await runExecutable('gt', ['log', '--short'], input.repo);
                const stack = run.stdout
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => ({
                        branch: line.replace(/^[*>\s-]+/, '').split(' ')[0] ?? line,
                        parent: null as string | null,
                    }));
                return {
                    stack,
                    error: run.error,
                    fallbackMode: 'graphite',
                };
            }),

        exportStack: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    stack: z.array(z.object({ branch: z.string(), parent: z.string().nullable().optional() })),
                })
            )
            .mutation(async ({ input }) => {
                const available = await commandExists('gt');
                if (!available) {
                    return {
                        success: false,
                        fallbackMode: 'local',
                        error: 'Graphite CLI not available. Stack export skipped.',
                    };
                }

                // Graphite does not provide a single command for importing arbitrary stack metadata.
                // We currently verify branch presence and return success to keep interoperability explicit.
                const missingBranches: string[] = [];
                for (const item of input.stack) {
                    const exists = await getGitService().runGitCommand(['show-ref', '--verify', `refs/heads/${item.branch}`], input.repo);
                    if (exists) {
                        missingBranches.push(item.branch);
                    }
                }

                return {
                    success: missingBranches.length === 0,
                    fallbackMode: 'graphite',
                    missingBranches,
                    error:
                        missingBranches.length === 0
                            ? null
                            : `Missing local branches: ${missingBranches.join(', ')}`,
                };
            }),

        validateStack: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    stack: z.array(
                        z.object({
                            branch: z.string(),
                            parent: z.string().nullable().optional(),
                            baseBranch: z.string().nullable().optional(),
                        })
                    ),
                })
            )
            .query(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) {
                    return { valid: false, issues: [initError], branches: [], error: initError };
                }

                const branchSet = new Set(input.stack.map((entry) => entry.branch));
                const issues: string[] = [];
                const branches = await Promise.all(
                    input.stack.map(async (entry) => {
                        const existsError = await getGitService().runGitCommand(
                            ['show-ref', '--verify', `refs/heads/${entry.branch}`],
                            input.repo
                        );
                        const exists = !existsError;

                        const expectedBase = entry.parent ?? entry.baseBranch ?? null;
                        let baseDrift = false;
                        if (exists && expectedBase) {
                            const mergeBase = await getGitService().runGitCommandWithOutput(
                                ['merge-base', entry.branch, expectedBase],
                                input.repo
                            );
                            const expectedSha = await getGitService().runGitCommandWithOutput(
                                ['rev-parse', expectedBase],
                                input.repo
                            );
                            baseDrift = (mergeBase?.trim() ?? '') !== (expectedSha?.trim() ?? '');
                        }

                        if (entry.parent && !branchSet.has(entry.parent)) {
                            issues.push(`${entry.branch} references missing parent ${entry.parent}`);
                        }
                        if (!exists) {
                            issues.push(`Missing local branch ${entry.branch}`);
                        }
                        if (baseDrift) {
                            issues.push(`${entry.branch} is drifted from expected base ${expectedBase ?? ''}`);
                        }

                        return {
                            branch: entry.branch,
                            exists,
                            parent: entry.parent ?? null,
                            baseBranch: entry.baseBranch ?? null,
                            baseDrift,
                        };
                    })
                );

                return {
                    valid: issues.length === 0,
                    issues,
                    branches,
                    error: null as string | null,
                };
            }),

        syncStack: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    stack: z.array(
                        z.object({
                            branch: z.string(),
                            parent: z.string().nullable().optional(),
                            baseBranch: z.string().nullable().optional(),
                        })
                    ),
                    push: z.boolean().optional().default(true),
                    forceWithLease: z.boolean().optional().default(true),
                    refreshPullRequests: z.boolean().optional().default(true),
                })
            )
            .mutation(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) {
                    return {
                        success: false,
                        mode: 'local' as const,
                        warnings: [initError],
                        branches: [] as Array<Record<string, unknown>>,
                        error: initError,
                    };
                }

                const warnings: string[] = [];
                const graphiteAvailable = await commandExists('gt');
                let mode: 'graphite' | 'local' = graphiteAvailable ? 'graphite' : 'local';

                if (graphiteAvailable) {
                    const restack = await runExecutable('gt', ['restack'], input.repo);
                    if (restack.error) {
                        warnings.push(`Graphite restack failed: ${restack.error}`);
                        mode = 'local';
                    }
                } else {
                    warnings.push('Graphite CLI unavailable, using local stack mode.');
                }

                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                const parsedRemote = remoteUrl ? parsePullRequestRemoteUrl(remoteUrl) : null;
                let prsByHead = new Map<string, PullRequestRecord>();

                if (input.refreshPullRequests) {
                    if (!remoteUrl || !parsedRemote) {
                        warnings.push('No PR provider remote configured; PR sync status unavailable.');
                    } else {
                        try {
                            const prs = await listRemotePullRequests(
                                remoteUrl,
                                parsedRemote.provider,
                                getStoredProviderAuthConfig(),
                                'open'
                            );
                            prsByHead = new Map(prs.map((pr) => [pr.head.ref, pr]));
                        } catch (error) {
                            warnings.push(
                                `Failed to refresh PRs: ${error instanceof Error ? error.message : 'Unknown error'}`
                            );
                        }
                    }
                }

                const stackBranchNames = new Set(input.stack.map((entry) => entry.branch));
                const branches = await Promise.all(
                    input.stack.map(async (entry) => {
                        const branchRef = `refs/heads/${entry.branch}`;
                        const existsError = await getGitService().runGitCommand(
                            ['show-ref', '--verify', branchRef],
                            input.repo
                        );
                        const exists = !existsError;

                        const expectedBase = entry.parent ?? entry.baseBranch ?? null;
                        let baseDrift = false;
                        if (exists && expectedBase) {
                            const mergeBase = await getGitService().runGitCommandWithOutput(
                                ['merge-base', entry.branch, expectedBase],
                                input.repo
                            );
                            const expectedSha = await getGitService().runGitCommandWithOutput(
                                ['rev-parse', expectedBase],
                                input.repo
                            );
                            baseDrift = (mergeBase?.trim() ?? '') !== (expectedSha?.trim() ?? '');
                        }

                        let pushError: string | null = null;
                        if (input.push && exists) {
                            const pushArgs = ['push', 'origin', entry.branch];
                            if (input.forceWithLease) {
                                pushArgs.push('--force-with-lease');
                            }
                            pushError = await getGitService().runGitCommand(pushArgs, input.repo);
                        }

                        const pr = prsByHead.get(entry.branch) ?? null;
                        const parentMissing = entry.parent ? !stackBranchNames.has(entry.parent) : false;
                        const needsAttention = Boolean(pushError || baseDrift || parentMissing || !exists);

                        return {
                            branch: entry.branch,
                            parent: entry.parent ?? null,
                            baseBranch: entry.baseBranch ?? null,
                            exists,
                            parentMissing,
                            baseDrift,
                            pushed: input.push && exists && !pushError,
                            pushError,
                            pr: pr
                                ? {
                                      number: pr.number,
                                      url: pr.webUrl,
                                      state: pr.state,
                                      draft: pr.draft,
                                  }
                                : null,
                            needsAttention,
                        };
                    })
                );

                return {
                    success: branches.every((entry) => !entry.pushError && entry.exists),
                    mode,
                    warnings,
                    summary: {
                        total: branches.length,
                        needsAttention: branches.filter((entry) => entry.needsAttention).length,
                        withPr: branches.filter((entry) => Boolean(entry.pr)).length,
                        pushed: branches.filter((entry) => entry.pushed).length,
                    },
                    branches,
                    error: null as string | null,
                };
            }),
    }),

    // ==================== Branch Pinning ====================

    branch: router({
        listPinned: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                })
            )
            .query(({ input }) => {
                const pinned = instanceStore.get('pinnedBranches');
                const map = pinned;
                return { branches: map[input.repo] ?? [], error: null };
            }),

        pin: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    branch: z.string().min(1),
                })
            )
            .mutation(({ input }) => {
                const current = instanceStore.get('pinnedBranches');
                const next = { ...current };
                const existing = next[input.repo] ?? [];
                if (!existing.includes(input.branch)) {
                    next[input.repo] = [...existing, input.branch];
                    instanceStore.set('pinnedBranches', next);
                }
                return { success: true, branches: next[input.repo] ?? [] };
            }),

        unpin: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    branch: z.string().min(1),
                })
            )
            .mutation(({ input }) => {
                const current = instanceStore.get('pinnedBranches');
                const next = { ...current };
                next[input.repo] = (next[input.repo] ?? []).filter((entry) => entry !== input.branch);
                instanceStore.set('pinnedBranches', next);
                return { success: true, branches: next[input.repo] ?? [] };
            }),

        smartList: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                })
            )
            .query(async ({ input }) => {
                const initError = await ensureGitInitialized();
                if (initError) return { branches: [] as Array<{ name: string; score: number; pinned: boolean }>, error: initError };

                const gitService = getGitService();
                const currentBranch =
                    (await gitService.runGitCommandWithOutput(['branch', '--show-current'], input.repo))?.trim() ?? '';
                const branchesOutput = await gitService.runGitCommandWithOutput(
                    ['for-each-ref', '--format=%(refname:short)|%(committerdate:unix)', 'refs/heads'],
                    input.repo
                );
                const aheadBehindOutput = await gitService.runGitCommandWithOutput(
                    ['for-each-ref', '--format=%(refname:short)|%(upstream:short)', 'refs/heads'],
                    input.repo
                );
                const pinned = instanceStore.get('pinnedBranches')[input.repo] ?? [];

                const upstreamByBranch = new Map<string, string>();
                for (const line of (aheadBehindOutput ?? '').split('\n').filter(Boolean)) {
                    const [branch = '', upstream = ''] = line.split('|');
                    if (branch && upstream) {
                        upstreamByBranch.set(branch, upstream);
                    }
                }

                const ranked = await Promise.all(
                    (branchesOutput ?? '')
                        .split('\n')
                        .filter(Boolean)
                        .map(async (line) => {
                            const [name = '', commitDate = '0'] = line.split('|');
                            const upstream = upstreamByBranch.get(name) ?? null;
                            const aheadBehind = await getWorktreeAheadBehind(name, upstream, input.repo);
                            const recentBoost = Math.max(0, 120 - Math.floor((Date.now() / 1000 - Number.parseInt(commitDate, 10)) / 3600));
                            const score =
                                (name === currentBranch ? 10_000 : 0) +
                                (pinned.includes(name) ? 3_000 : 0) +
                                Math.max(aheadBehind.ahead, aheadBehind.behind) * 20 +
                                recentBoost;

                            return {
                                name,
                                pinned: pinned.includes(name),
                                current: name === currentBranch,
                                ahead: aheadBehind.ahead,
                                behind: aheadBehind.behind,
                                score,
                            };
                        })
                );

                ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
                return { branches: ranked, error: null };
            }),
    }),

    // ==================== Launchpad Status Mapping ====================

    launchpad: router({
        setStatusMap: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                    map: z.record(z.string(), z.object({ label: z.string(), severity: z.enum(['info', 'warn', 'error']) })),
                })
            )
            .mutation(({ input }) => {
                const current = instanceStore.get('launchpadStatusMap');
                const next = { ...current };
                next[input.repo] = input.map;
                instanceStore.set('launchpadStatusMap', next);
                return { success: true };
            }),

        getStatusMap: publicProcedure
            .input(
                z.object({
                    repo: z.string(),
                })
            )
            .query(({ input }) => {
                const map = instanceStore.get('launchpadStatusMap');
                return {
                    map: map[input.repo] ?? {},
                    error: null,
                };
            }),
    }),

    // ==================== Line Staging ====================
    stageLines: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                filePath: z.string(),
                patch: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            try {
                const gitService = getGitService();
                const gitPath = gitService.getGitExecutable()?.path;
                if (!gitPath) {
                    return { error: 'Git executable not available' };
                }

                const { spawn } = await import('child_process');

                // Apply the patch using git apply --cached with stdin
                const result = await new Promise<{ error: string | null }>((resolve) => {
                    const cmd = spawn(gitPath, ['apply', '--cached', '--recount', '--unidiff-zero', '-'], {
                        cwd: input.repo,
                    });

                    cmd.stdin.write(input.patch);
                    cmd.stdin.end();

                    let stderr = '';
                    cmd.stderr.on('data', (data: Buffer) => {
                        stderr += data.toString();
                    });

                    cmd.on('close', (code) => {
                        if (code === 0) {
                            resolve({ error: null });
                        } else {
                            resolve({ error: stderr || `Git apply failed with code ${String(code ?? 'unknown')}` });
                        }
                    });

                    cmd.on('error', (err) => {
                        resolve({ error: err.message });
                    });
                });
                return result;
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    // ==================== Custom Commands ====================
    runCustomCommand: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                command: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { output: null, error: initError };

            try {
                const gitService = getGitService();
                const output = await gitService.runGitCommandWithOutput(input.command.split(' '), input.repo);
                return { output, error: null };
            } catch (error) {
                return { output: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    // ==================== Search Commits ====================
    searchCommits: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                query: z.string(),
                type: z.enum(['message', 'author', 'file', 'hash']).optional().default('message'),
                limit: z.number().optional().default(50),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { commits: [], error: initError };

            try {
                const gitService = getGitService();
                let args: string[];

                switch (input.type) {
                    case 'author':
                        args = ['log', '--all', '--oneline', `--author=${input.query}`, `-n`, String(input.limit)];
                        break;
                    case 'hash':
                        args = ['log', '--all', '--oneline', `--grep=${input.query}`, `-n`, String(input.limit)];
                        break;
                    case 'file':
                        args = ['log', '--all', '--oneline', `--name-only`, `-n`, String(input.limit)];
                        // For file search, we need to filter results
                        break;
                    default:
                        args = ['log', '--all', '--oneline', `--grep=${input.query}`, `-n`, String(input.limit)];
                }

                const output = await gitService.runGitCommandWithOutput(args, input.repo);

                if (!output) {
                    return { commits: [], error: null };
                }

                // Parse log output
                const commits = output
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => {
                        const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
                        if (match) {
                            return {
                                hash: match[1],
                                message: match[2],
                                author: '',
                                date: 0,
                            };
                        }
                        return null;
                    })
                    .filter(Boolean) as Array<{ hash: string; message: string; author: string; date: number }>;

                // For file search, we need to get more details
                if (input.type === 'file') {
                    // Get commits that touched files matching the query
                    const fileArgs = [
                        'log',
                        '--all',
                        '--format=%H|%s|%an|%ct',
                        '--name-only',
                        `-n`,
                        String(input.limit * 2),
                    ];
                    const fileOutput = await gitService.runGitCommandWithOutput(fileArgs, input.repo);

                    if (fileOutput) {
                        const matchingCommits: Array<{ hash: string; message: string; author: string; date: number }> =
                            [];
                        const lines = fileOutput.split('\n');
                        let currentCommit: { hash: string; message: string; author: string; date: number } | null =
                            null;

                        for (const line of lines) {
                            if (line.includes('|')) {
                                const [hash = '', message = '', author = '', date = '0'] = line.split('|');
                                currentCommit = { hash, message, author, date: parseInt(date, 10) };
                            } else if (
                                line &&
                                currentCommit &&
                                line.toLowerCase().includes(input.query.toLowerCase())
                            ) {
                                if (!matchingCommits.find((c) => c.hash === currentCommit?.hash)) {
                                    matchingCommits.push(currentCommit);
                                }
                            }
                        }

                        return { commits: matchingCommits.slice(0, input.limit), error: null };
                    }
                } else {
                    // Get author and date for non-file searches
                    const detailedCommits = await Promise.all(
                        commits.slice(0, input.limit).map(async (commit) => {
                            const detailArgs = ['log', '-1', '--format=%an|%ct', commit.hash];
                            const detailOutput = await gitService.runGitCommandWithOutput(detailArgs, input.repo);
                            if (detailOutput) {
                                const [author = '', date = '0'] = detailOutput.split('|');
                                return { ...commit, author, date: parseInt(date, 10) };
                            }
                            return commit;
                        })
                    );

                    return { commits: detailedCommits, error: null };
                }

                return { commits: [], error: null };
            } catch (error) {
                return { commits: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    // ==================== Pull Request Integration ====================
    getPullRequestAuth: publicProcedure.query(() => {
        const auth = getStoredProviderAuthConfig();
        return {
            auth: {
                githubToken: auth.githubToken ?? '',
                gitlabToken: auth.gitlabToken ?? '',
                bitbucketToken: auth.bitbucketToken ?? '',
                bitbucketUsername: auth.bitbucketUsername ?? '',
                azureToken: auth.azureToken ?? '',
            },
            hasAuth: {
                github: Boolean(auth.githubToken),
                gitlab: Boolean(auth.gitlabToken),
                bitbucket: Boolean(auth.bitbucketToken),
                azure: Boolean(auth.azureToken),
            },
        };
    }),

    setPullRequestAuth: publicProcedure
        .input(
            z.object({
                githubToken: z.string().nullable().optional(),
                gitlabToken: z.string().nullable().optional(),
                bitbucketToken: z.string().nullable().optional(),
                bitbucketUsername: z.string().nullable().optional(),
                azureToken: z.string().nullable().optional(),
            })
        )
        .mutation(({ input }) => {
            const current = hydrateProviderAuthConfig();
            const next: ProviderAuthConfig = {};
            const githubToken =
                input.githubToken === undefined ? current.githubToken : (input.githubToken ?? '').trim();
            const gitlabToken =
                input.gitlabToken === undefined ? current.gitlabToken : (input.gitlabToken ?? '').trim();
            const bitbucketToken =
                input.bitbucketToken === undefined ? current.bitbucketToken : (input.bitbucketToken ?? '').trim();
            const bitbucketUsername =
                input.bitbucketUsername === undefined
                    ? current.bitbucketUsername
                    : (input.bitbucketUsername ?? '').trim();
            const azureToken =
                input.azureToken === undefined ? current.azureToken : (input.azureToken ?? '').trim();

            if (githubToken !== undefined) next.githubToken = githubToken;
            if (gitlabToken !== undefined) next.gitlabToken = gitlabToken;
            if (bitbucketToken !== undefined) next.bitbucketToken = bitbucketToken;
            if (bitbucketUsername !== undefined) next.bitbucketUsername = bitbucketUsername;
            if (azureToken !== undefined) next.azureToken = azureToken;

            persistProviderAuthConfig(next);
            return {
                success: true,
                hasAuth: {
                    github: Boolean(next.githubToken),
                    gitlab: Boolean(next.gitlabToken),
                    bitbucket: Boolean(next.bitbucketToken),
                    azure: Boolean(next.azureToken),
                },
            };
        }),

    detectPullRequestProvider: publicProcedure
        .input(z.object({ repo: z.string() }))
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { remoteUrl: null, provider: null, error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { remoteUrl: null, provider: null, error: 'No remotes configured for this repository.' };
                }
                const parsed = parsePullRequestRemoteUrl(remoteUrl);
                return {
                    remoteUrl,
                    provider: parsed?.provider ?? null,
                    error: null,
                };
            } catch (error) {
                return {
                    remoteUrl: null,
                    provider: null,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    ciStatus: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                commitHash: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) {
                return {
                    status: 'unknown' as const,
                    provider: 'unknown' as const,
                    workflowName: null,
                    runId: null,
                    url: null,
                    error: initError,
                };
            }

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return {
                        status: 'unknown' as const,
                        provider: 'unknown' as const,
                        workflowName: null,
                        runId: null,
                        url: null,
                        error: 'No remotes configured for this repository.',
                    };
                }

                const target = parsePullRequestRemoteUrl(remoteUrl);
                if (!target) {
                    return {
                        status: 'unknown' as const,
                        provider: 'unknown' as const,
                        workflowName: null,
                        runId: null,
                        url: null,
                        error: 'Unable to detect provider from repository remotes.',
                    };
                }

                const auth = getStoredProviderAuthConfig();

                switch (target.provider) {
                    case 'github': {
                        if (!auth.githubToken) {
                            return {
                                status: 'unknown' as const,
                                provider: 'github' as const,
                                workflowName: null,
                                runId: null,
                                url: null,
                                error: 'GitHub token is not configured.',
                            };
                        }
                        const response = await fetch(
                            `${target.apiBaseUrl}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/commits/${encodeURIComponent(input.commitHash)}/status`,
                            {
                                headers: {
                                    Accept: 'application/vnd.github+json',
                                    Authorization: `Bearer ${auth.githubToken}`,
                                    'User-Agent': 'vscode-git-graph-electron',
                                },
                            }
                        );
                        if (!response.ok) {
                            const body = await response.text();
                            throw new Error(body || response.statusText);
                        }
                        const payload = (await response.json()) as {
                            state?: string;
                            statuses?: Array<{ context?: string; target_url?: string; id?: number | string }>;
                        };
                        const firstStatus = Array.isArray(payload.statuses) ? payload.statuses[0] : undefined;
                        return {
                            status: mapCiStatusFromGitHub(payload.state),
                            provider: 'github' as const,
                            workflowName: firstStatus?.context ?? 'GitHub Checks',
                            runId:
                                typeof firstStatus?.id === 'number' || typeof firstStatus?.id === 'string'
                                    ? String(firstStatus.id)
                                    : null,
                            url: firstStatus?.target_url ?? null,
                            error: null,
                        };
                    }
                    case 'gitlab': {
                        if (!auth.gitlabToken) {
                            return {
                                status: 'unknown' as const,
                                provider: 'gitlab' as const,
                                workflowName: null,
                                runId: null,
                                url: null,
                                error: 'GitLab token is not configured.',
                            };
                        }
                        const projectId = encodeURIComponent(target.projectPath);
                        const response = await fetch(
                            `${target.apiBaseUrl}/projects/${projectId}/repository/commits/${encodeURIComponent(input.commitHash)}/statuses?per_page=1`,
                            {
                                headers: {
                                    Accept: 'application/json',
                                    'PRIVATE-TOKEN': auth.gitlabToken,
                                    'User-Agent': 'vscode-git-graph-electron',
                                },
                            }
                        );
                        if (!response.ok) {
                            const body = await response.text();
                            throw new Error(body || response.statusText);
                        }
                        const statuses = (await response.json()) as Array<{
                            status?: string;
                            name?: string;
                            id?: number | string;
                            target_url?: string;
                        }>;
                        const firstStatus = statuses[0];
                        return {
                            status: mapCiStatusFromGitLab(firstStatus?.status),
                            provider: 'gitlab' as const,
                            workflowName: firstStatus?.name ?? 'GitLab CI',
                            runId:
                                typeof firstStatus?.id === 'number' || typeof firstStatus?.id === 'string'
                                    ? String(firstStatus.id)
                                    : null,
                            url: firstStatus?.target_url ?? null,
                            error: null,
                        };
                    }
                    case 'bitbucket': {
                        if (!auth.bitbucketToken) {
                            return {
                                status: 'unknown' as const,
                                provider: 'bitbucket' as const,
                                workflowName: null,
                                runId: null,
                                url: null,
                                error: 'Bitbucket token is not configured.',
                            };
                        }
                        const authHeader = auth.bitbucketUsername
                            ? `Basic ${Buffer.from(`${auth.bitbucketUsername}:${auth.bitbucketToken}`).toString('base64')}`
                            : `Bearer ${auth.bitbucketToken}`;

                        const response = await fetch(
                            `${target.apiBaseUrl}/repositories/${encodeURIComponent(target.workspace)}/${encodeURIComponent(target.repoSlug)}/commit/${encodeURIComponent(input.commitHash)}/statuses?pagelen=1&sort=-updated_on`,
                            {
                                headers: {
                                    Accept: 'application/json',
                                    Authorization: authHeader,
                                    'User-Agent': 'vscode-git-graph-electron',
                                },
                            }
                        );
                        if (!response.ok) {
                            const body = await response.text();
                            throw new Error(body || response.statusText);
                        }
                        const payload = (await response.json()) as {
                            values?: Array<{ state?: string; name?: string; key?: string; url?: string }>;
                        };
                        const firstStatus = Array.isArray(payload.values) ? payload.values[0] : undefined;
                        return {
                            status: mapCiStatusFromBitbucket(firstStatus?.state),
                            provider: 'bitbucket' as const,
                            workflowName: firstStatus?.name ?? firstStatus?.key ?? 'Bitbucket Pipelines',
                            runId: firstStatus?.key ?? null,
                            url: firstStatus?.url ?? null,
                            error: null,
                        };
                    }
                    case 'azure': {
                        if (!auth.azureToken) {
                            return {
                                status: 'unknown' as const,
                                provider: 'azure' as const,
                                workflowName: null,
                                runId: null,
                                url: null,
                                error: 'Azure DevOps token is not configured.',
                            };
                        }
                        const response = await fetch(
                            `${target.apiBaseUrl}/commits/${encodeURIComponent(input.commitHash)}/statuses?api-version=7.1`,
                            {
                                headers: {
                                    Accept: 'application/json',
                                    Authorization: `Basic ${Buffer.from(`:${auth.azureToken}`).toString('base64')}`,
                                    'User-Agent': 'vscode-git-graph-electron',
                                },
                            }
                        );
                        if (!response.ok) {
                            const body = await response.text();
                            throw new Error(body || response.statusText);
                        }
                        const payload = (await response.json()) as {
                            value?: Array<{
                                state?: string;
                                description?: string;
                                context?: { genre?: string; name?: string };
                                targetUrl?: string;
                            }>;
                        };
                        const firstStatus = Array.isArray(payload.value) ? payload.value[0] : undefined;
                        const normalizedState = (firstStatus?.state ?? '').toLowerCase();
                        const status =
                            normalizedState === 'succeeded'
                                ? 'success'
                                : normalizedState === 'failed' || normalizedState === 'error'
                                  ? 'failure'
                                  : normalizedState === 'notset' || normalizedState === 'pending'
                                    ? 'pending'
                                    : 'unknown';
                        return {
                            status,
                            provider: 'azure' as const,
                            workflowName: firstStatus?.context?.name ?? firstStatus?.description ?? 'Azure Pipelines',
                            runId: firstStatus?.context?.genre ?? null,
                            url: firstStatus?.targetUrl ?? null,
                            error: null,
                        };
                    }
                }
            } catch (error) {
                return {
                    status: 'unknown' as const,
                    provider: 'unknown' as const,
                    workflowName: null,
                    runId: null,
                    url: null,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    listPullRequests: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                state: z.enum(['open', 'closed', 'all']).optional().default('open'),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) {
                return { pullRequests: [], remoteUrl: null, detectedProvider: null, error: initError };
            }

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return {
                        pullRequests: [],
                        remoteUrl: null,
                        detectedProvider: null,
                        error: 'No remotes configured for this repository.',
                    };
                }

                const parsed = parsePullRequestRemoteUrl(remoteUrl);
                if (!parsed) {
                    return {
                        pullRequests: [],
                        remoteUrl,
                        detectedProvider: null,
                        error: 'Unable to detect pull request provider from repository remotes.',
                    };
                }

                const auth = getStoredProviderAuthConfig();
                const pullRequests = await listRemotePullRequests(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    input.state
                );
                return {
                    pullRequests,
                    remoteUrl,
                    detectedProvider: parsed.provider,
                    error: null,
                };
            } catch (error) {
                return {
                    pullRequests: [],
                    remoteUrl: null,
                    detectedProvider: null,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        }),

    createPullRequest: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                title: z.string(),
                body: z.string().optional(),
                head: z.string(),
                base: z.string(),
                draft: z.boolean().optional().default(false),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { pullRequest: null, error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { pullRequest: null, error: 'No remotes configured for this repository.' };
                }

                const auth = getStoredProviderAuthConfig();
                const createPayload: {
                    title: string;
                    head: string;
                    base: string;
                    body?: string;
                    draft?: boolean;
                } = {
                    title: input.title,
                    head: input.head,
                    base: input.base,
                };
                if (typeof input.body === 'string') {
                    createPayload.body = input.body;
                }
                if (typeof input.draft === 'boolean') {
                    createPayload.draft = input.draft;
                }
                const pullRequest = await createRemotePullRequest(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    createPayload
                );
                return { pullRequest, error: null };
            } catch (error) {
                return { pullRequest: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    getPullRequest: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                number: z.number(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { pullRequest: null, error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { pullRequest: null, error: 'No remotes configured for this repository.' };
                }
                const auth = getStoredProviderAuthConfig();
                const pullRequest = await getRemotePullRequest(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    input.number
                );
                return { pullRequest, error: null };
            } catch (error) {
                return { pullRequest: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    listPullRequestComments: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                number: z.number(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { comments: [], error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { comments: [], error: 'No remotes configured for this repository.' };
                }
                const auth = getStoredProviderAuthConfig();
                const comments = await listRemotePullRequestComments(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    input.number
                );
                return { comments, error: null };
            } catch (error) {
                return { comments: [], error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    getPullRequestReviewState: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                number: z.number(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { reviewState: null, error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { reviewState: null, error: 'No remotes configured for this repository.' };
                }
                const auth = getStoredProviderAuthConfig();
                const reviewState = await getRemotePullRequestReviewState(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    input.number
                );
                return { reviewState, error: null };
            } catch (error) {
                return { reviewState: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    addPullRequestComment: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                number: z.number(),
                body: z.string().min(1),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { comment: null, error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { comment: null, error: 'No remotes configured for this repository.' };
                }
                const auth = getStoredProviderAuthConfig();
                const comment = await addRemotePullRequestComment(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    input.number,
                    input.body
                );
                return { comment, error: null };
            } catch (error) {
                return { comment: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    addPullRequestInlineComment: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                number: z.number(),
                body: z.string().min(1),
                filePath: z.string().min(1),
                line: z.number().int().positive(),
                side: z.enum(['left', 'right']),
                baseSha: z.string().optional(),
                startSha: z.string().optional(),
                headSha: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { comment: null, error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { comment: null, error: 'No remotes configured for this repository.' };
                }
                const auth = getStoredProviderAuthConfig();
                const comment = await addRemotePullRequestInlineComment(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    input.number,
                    {
                        body: input.body,
                        filePath: input.filePath,
                        line: input.line,
                        side: input.side,
                        ...withDefinedProps({
                            baseSha: input.baseSha,
                            startSha: input.startSha,
                            headSha: input.headSha,
                        }),
                    }
                );
                return { comment, error: null };
            } catch (error) {
                return { comment: null, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    mergePullRequest: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                number: z.number(),
                mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional().default('merge'),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { error: 'No remotes configured for this repository.' };
                }
                const auth = getStoredProviderAuthConfig();
                await mergeRemotePullRequest(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    input.number,
                    input.mergeMethod
                );
                return { error: null };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    closePullRequest: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                provider: pullRequestProviderSchema,
                number: z.number(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            try {
                const remoteUrl = await getPreferredRemoteUrlForPullRequests(input.repo);
                if (!remoteUrl) {
                    return { error: 'No remotes configured for this repository.' };
                }
                const auth = getStoredProviderAuthConfig();
                await closeRemotePullRequest(
                    remoteUrl,
                    input.provider as PullRequestProvider,
                    auth,
                    input.number
                );
                return { error: null };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    // ==================== Stash Operations ====================
    stashList: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { stashes: [], error: initError };

        try {
            const gitService = getGitService();
            const output = await gitService.runGitCommandWithOutput(
                ['stash', 'list', '--format=%gd|%gs|%h|%ci'],
                input.repo
            );

            const stashes = (output ?? '')
                .split('\n')
                .filter(Boolean)
                .map((line) => {
                    const [ref, message, hash, date] = line.split('|');
                    const indexMatch = ref?.match(/stash@\{(\d+)\}/);
                    const branchMatch = message?.match(/^WIP on ([^:]+):/);

                    return {
                        index: parseInt(indexMatch?.[1] ?? '0', 10) || 0,
                        message: message || '',
                        branch: branchMatch?.[1] ?? '',
                        hash: hash || '',
                        date: date || '',
                        files: [] as { path: string; additions: number; deletions: number }[],
                    };
                });

            return { stashes, error: null };
        } catch (error) {
            return { stashes: [], error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }),

    stashPush: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                message: z.string().optional(),
                includeUntracked: z.boolean().optional().default(true),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const args = ['stash', 'push'];
            if (input.message) {
                args.push('-m', input.message);
            }
            if (input.includeUntracked) {
                args.push('--include-untracked');
            }

            const error = await getGitService().runGitCommand(args, input.repo);
            return { error };
        }),

    stashApply: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                index: z.number(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['stash', 'apply', `stash@{${String(input.index)}}`],
                input.repo
            );
            return { error };
        }),

    stashPop: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                index: z.number(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['stash', 'pop', `stash@{${String(input.index)}}`],
                input.repo
            );
            return { error };
        }),

    stashDrop: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                index: z.number(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['stash', 'drop', `stash@{${String(input.index)}}`],
                input.repo
            );
            return { error };
        }),

    stashBranch: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                index: z.number(),
                branchName: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['stash', 'branch', input.branchName, `stash@{${String(input.index)}}`],
                input.repo
            );
            return { error };
        }),

    stashClear: publicProcedure.input(z.object({ repo: z.string() })).mutation(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return { error: initError };

        const error = await getGitService().runGitCommand(['stash', 'clear'], input.repo);
        return { error };
    }),

    /**
     * Get git configuration as key-value object.
     */
    configList: publicProcedure.input(z.object({ repo: z.string() })).query(async ({ input }) => {
        const initError = await ensureGitInitialized();
        if (initError) return {};

        try {
            const result = await getGitService().runGitCommandWithOutput(['config', '--list', '--global'], input.repo);

            const config: Record<string, string> = {};
            result?.split('\n').forEach((line) => {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    config[key] = valueParts.join('=');
                }
            });

            return config;
        } catch {
            return {};
        }
    }),

    /**
     * Set a git configuration value.
     */
    configSet: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                key: z.string(),
                value: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(
                ['config', '--global', input.key, input.value],
                input.repo
            );
            return { error };
        }),

    /**
     * Unset a git configuration value.
     */
    configUnset: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                key: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            const error = await getGitService().runGitCommand(['config', '--global', '--unset', input.key], input.repo);
            return { error };
        }),

    /**
     * Get raw git configuration file content.
     */
    configRaw: publicProcedure.input(z.object({ repo: z.string() })).query(async () => {
        const initError = await ensureGitInitialized();
        if (initError) return '';

        try {
            const configPath = resolveGlobalGitConfigPath();
            if (!(await fileExists(configPath))) {
                return '';
            }
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            return await fs.readFile(configPath, 'utf8');
        } catch {
            return '';
        }
    }),

    /**
     * Set raw git configuration.
     */
    configSetRaw: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                content: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            try {
                const configPath = resolveGlobalGitConfigPath();
                const configDir = path.dirname(configPath);
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await fs.mkdir(configDir, { recursive: true });

                const now = Date.now().toString();
                const tmpPath = `${configPath}.tmp-${now}`;
                const backupPath = `${configPath}.bak-${now}`;

                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await fs.writeFile(tmpPath, input.content, 'utf8');

                const validationError = await getGitService().runGitCommand(
                    ['config', '--file', tmpPath, '--list'],
                    input.repo
                );
                if (validationError) {
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    await fs.unlink(tmpPath).catch(() => undefined);
                    return { error: `Invalid git config content: ${validationError}` };
                }

                if (await fileExists(configPath)) {
                    await fs.copyFile(configPath, backupPath);
                }

                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await fs.rename(tmpPath, configPath);
                return { error: null, backupPath: (await fileExists(backupPath)) ? backupPath : null };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Test if a diff tool is available.
     */
    testDiffTool: publicProcedure
        .input(
            z.object({
                command: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const { spawn } = await import('child_process');
                const result = await new Promise<{ available: boolean }>((resolve) => {
                    const proc = spawn(input.command, ['--version'], { shell: true });
                    proc.on('close', (code) => {
                        resolve({ available: code === 0 });
                    });
                    proc.on('error', () => {
                        resolve({ available: false });
                    });
                });
                return result;
            } catch {
                return { available: false };
            }
        }),

    /**
     * Open external diff tool.
     */
    openExternalDiff: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                filePath: z.string(),
                commitHash: z.string().optional(),
                onCommit: z.string().optional(),
                command: z.string(),
                args: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return { error: initError };

            try {
                // Get file contents
                const oldContent = input.onCommit
                    ? await getGitService().runGitCommandWithOutput(
                          ['show', `${input.onCommit}:${input.filePath}`],
                          input.repo
                      )
                    : '';

                const newContent = input.commitHash
                    ? await getGitService().runGitCommandWithOutput(
                          ['show', `${input.commitHash}:${input.filePath}`],
                          input.repo
                      )
                    : '';

                // Write temp files
                const fs = await import('fs');
                const os = await import('os');
                const path = await import('path');

                const tmpDir = os.tmpdir();
                const oldFile = path.join(tmpDir, 'git-diff-old');
                const newFile = path.join(tmpDir, 'git-diff-new');

                fs.writeFileSync(oldFile, oldContent || '');
                fs.writeFileSync(newFile, newContent || '');

                // Replace variables in args
                const args = input.args
                    .replace(/\$LOCAL/g, oldFile)
                    .replace(/\$REMOTE/g, newFile)
                    .replace(/\$BASE/g, oldFile)
                    .replace(/\$MERGED/g, newFile);

                // Spawn diff tool
                const { spawn } = await import('child_process');
                spawn(input.command, args.split(' '), { shell: true, detached: true });

                return { error: null };
            } catch (error) {
                return { error: error instanceof Error ? error.message : 'Unknown error' };
            }
        }),

    /**
     * Get commit info for a specific hash.
     */
    commitInfo: publicProcedure
        .input(
            z.object({
                repo: z.string(),
                hash: z.string(),
            })
        )
        .query(async ({ input }) => {
            const initError = await ensureGitInitialized();
            if (initError) return null;

            try {
                const result = await getGitService().runGitCommandWithOutput(
                    ['show', '-s', '--format=%H%n%an%n%ae%n%at%n%s%n%b', input.hash],
                    input.repo
                );

                if (!result) return null;

                const [hash, author, email, timestamp, subject, ...body] = result.split('\n');

                return {
                    hash: hash ?? '',
                    author: author ?? '',
                    email: email ?? '',
                    date: new Date((parseInt(timestamp ?? '0', 10) || 0) * 1000).toISOString(),
                    message: subject ?? '',
                    body: body.join('\n').trim(),
                };
            } catch {
                return null;
            }
        }),
});
