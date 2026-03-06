#!/usr/bin/env node

import path from 'node:path';
import { spawn } from 'node:child_process';

function openUrl(url) {
	const platform = process.platform;
	if (platform === 'darwin') {
		spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
		return;
	}
	if (platform === 'win32') {
		spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
		return;
	}
	spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

function makeLink(target) {
	const url = new URL('gitgraph://open');
	if (target.repo) url.searchParams.set('repo', path.resolve(target.repo));
	if (target.branch) url.searchParams.set('branch', target.branch);
	if (target.commit) url.searchParams.set('commit', target.commit);
	if (target.file) url.searchParams.set('file', target.file);
	if (target.panel) url.searchParams.set('panel', target.panel);
	return url.toString();
}

function printHelp() {
	console.log(`gg - open Git Graph with context

Usage:
  gg open [repo] [--branch <name>] [--commit <sha>] [--file <path>] [--panel <worktree|diff|blame>]
  gg blame <file> [--repo <path>]
  gg diff [commit-ish] [--repo <path>] [--file <path>]
  gg worktree [path]
`);
}

function readFlag(args, ...names) {
	for (let index = 0; index < args.length; index += 1) {
		const value = args[index];
		if (!value || !names.includes(value)) {
			continue;
		}
		const next = args[index + 1];
		return typeof next === 'string' ? next : null;
	}
	return null;
}

function hasFlag(args, ...names) {
	return args.some((value) => names.includes(value));
}

function positional(args) {
	return args.filter((value) => !value.startsWith('-'));
}

const argv = process.argv.slice(2);
const command = argv[0] ?? 'open';
const args = argv.slice(1);

if (command === 'help' || command === '--help' || command === '-h') {
	printHelp();
	process.exit(0);
}

if (command === 'open') {
	const values = positional(args);
	const repo = values[0] ?? process.cwd();
	const branch = readFlag(args, '--branch', '-b') ?? undefined;
	const commit = readFlag(args, '--commit', '-c') ?? undefined;
	const file = readFlag(args, '--file', '-f') ?? undefined;
	const panel = readFlag(args, '--panel', '-p');
	const nextPanel = panel === 'worktree' || panel === 'diff' || panel === 'blame' ? panel : undefined;
	openUrl(makeLink({ repo, branch, commit, file, panel: nextPanel }));
	process.exit(0);
}

if (command === 'blame') {
	const values = positional(args);
	const file = values[0];
	if (!file) {
		console.error('gg blame requires a file path');
		process.exit(1);
	}
	const repo = readFlag(args, '--repo', '-r') ?? process.cwd();
	openUrl(
		makeLink({
			repo,
			file,
			panel: 'blame',
		})
	);
	process.exit(0);
}

if (command === 'diff') {
	const values = positional(args);
	const commit = values[0] ?? 'HEAD';
	const repo = readFlag(args, '--repo', '-r') ?? process.cwd();
	const file = readFlag(args, '--file', '-f') ?? undefined;
	openUrl(
		makeLink({
			repo,
			commit,
			file,
			panel: 'diff',
		})
	);
	process.exit(0);
}

if (command === 'worktree') {
	const values = positional(args);
	const repo = values[0] ?? readFlag(args, '--repo', '-r') ?? process.cwd();
	openUrl(makeLink({ repo, panel: 'worktree' }));
	process.exit(0);
}

if (hasFlag(argv, '--help', '-h')) {
	printHelp();
	process.exit(0);
}

printHelp();
process.exit(1);
