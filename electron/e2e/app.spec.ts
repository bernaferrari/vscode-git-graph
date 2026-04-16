/**
 * E2E Tests for Git Graph Application
 */

import { test, expect, ElectronApp, Page, _electron as electron } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import electronBinaryPath from 'electron';
import { existsSync } from 'node:fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

let electronApp: ElectronApp;
let page: Page;
const canRunElectronE2E = spawnSync(electronBinaryPath, ['--version'], { stdio: 'ignore' }).status === 0;

test.skip(!canRunElectronE2E, 'Electron runtime unavailable in the current environment.');

test.beforeAll(async () => {
	const mainEntry = path.resolve(currentDir, '../dist-electron/main.js');
	if (!existsSync(mainEntry)) {
		throw new Error('Build the app first with `pnpm build` before running e2e tests.');
	}

	electronApp = await electron.launch({
		args: [mainEntry],
		cwd: path.resolve(currentDir, '..'),
		env: {
			...process.env,
			NODE_ENV: 'test',
		},
	});

	page = await electronApp.firstWindow();
	await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
	if (electronApp) {
		await electronApp.close();
	}
});

test.describe('Application Launch', () => {
	test('should launch the application', async () => {
		await expect(page).toHaveTitle(/Git Graph/);
		await expect(page.getByText(/open a repository or resume a workspace/i)).toBeVisible();
	});
});

test.describe('Repository Selection', () => {
	test('should have open repository button', async () => {
		await expect(page.getByRole('button', { name: /open repository/i }).first()).toBeVisible();
	});

	test('should surface multi-repo onboarding cards', async () => {
		await expect(page.getByText(/multi-repo focus/i)).toBeVisible();
		await expect(page.getByText(/review focus/i)).toBeVisible();
		await expect(page.getByText(/safer recovery/i)).toBeVisible();
	});
});
