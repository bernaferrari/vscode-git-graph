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
		await expect(page.getByText(/open a repository/i)).toBeVisible();
	});
});

test.describe('Repository Selection', () => {
	test('should have open repository button', async () => {
		await expect(page.getByRole('button', { name: /open repository/i }).first()).toBeVisible();
	});

	test('should keep first-run choice focused', async () => {
		await expect(page.getByText(/no repository selected/i)).toBeVisible();
		await expect(page.getByText(/workspace flow|multi-repo focus|review focus|safer recovery/i)).not.toBeVisible();
	});
});

test.describe('Visual Shell Regression', () => {
	test('renders a nonblank first-run shell on desktop', async () => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(page.getByText(/open a repository/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /open repository/i }).first()).toBeVisible();

		const screenshot = await page.screenshot();
		expect(screenshot.byteLength).toBeGreaterThan(20_000);
	});

	test('keeps the first-run shell usable on narrow screens', async () => {
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByText(/open a repository/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /open repository/i }).first()).toBeVisible();

		const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
		expect(hasHorizontalOverflow).toBe(false);
	});

	test('centers the primary onboarding action', async () => {
		await page.setViewportSize({ width: 1024, height: 768 });
		const primary = page.locator('#main-content').getByRole('button', { name: /open repository/i }).first();
		const primaryBox = await primary.boundingBox();

		expect(primaryBox).not.toBeNull();
		if (!primaryBox) return;

		const buttonCenter = primaryBox.x + primaryBox.width / 2;
		expect(buttonCenter).toBeGreaterThan(300);
		expect(buttonCenter).toBeLessThan(724);
	});
});
