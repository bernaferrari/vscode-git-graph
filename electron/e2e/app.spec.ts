/**
 * E2E Tests for Git Graph Application
 */

import { test, expect, ElectronApp, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import { existsSync } from 'node:fs';
import * as path from 'path';

let electronApp: ElectronApp;
let page: Page;

test.beforeAll(async () => {
	const mainEntry = path.resolve(__dirname, '../dist-electron/main.js');
	if (!existsSync(mainEntry)) {
		throw new Error('Build the app first with `pnpm build` before running e2e tests.');
	}

	electronApp = await electron.launch({
		args: [mainEntry],
		cwd: path.resolve(__dirname, '..'),
		env: {
			...process.env,
			NODE_ENV: 'test',
		},
	});

	page = await electronApp.firstWindow();
	await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
	await electronApp.close();
});

test.describe('Application Launch', () => {
	test('should launch the application', async () => {
		await expect(page).toHaveTitle(/Git Graph/);
		await expect(page.getByRole('heading', { name: /welcome to git graph/i })).toBeVisible();
	});
});

test.describe('Repository Selection', () => {
	test('should have open repository button', async () => {
		await expect(page.getByRole('button', { name: /open repository/i })).toBeVisible();
	});
});
