/**
 * E2E Tests for Git Graph Application
 */

import { test, expect, ElectronApp, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';

let electronApp: ElectronApp;
let page: Page;

test.beforeAll(async () => {
	electronApp = await electron.launch({
		args: [path.join(__dirname, '../dist-electron/main.js')],
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
		const title = await page.title();
		expect(title).toContain('Git Graph');
	});

	test('should show no repository selected message', async () => {
		await expect(page.getByText('No Repository Selected')).toBeVisible();
	});
});

test.describe('Repository Selection', () => {
	test('should have open repository button', async () => {
		const openButton = page.getByRole('button', { name: /open/i });
		await expect(openButton).toBeVisible();
	});
});

test.describe('Keyboard Shortcuts', () => {
	test('should open find widget with Cmd+F', async () => {
		await page.keyboard.press('Meta+f');
		// Find widget should appear
		await expect(page.getByPlaceholder(/search|find/i)).toBeVisible();
	});
});

test.describe('Accessibility', () => {
	test('should have proper heading structure', async () => {
		const headings = await page.$$('h1, h2, h3');
		expect(headings.length).toBeGreaterThan(0);
	});

	test('should have accessible buttons', async () => {
		const buttons = await page.$$('button');
		for (const button of buttons) {
			const hasLabel = await button.getAttribute('aria-label');
			const hasText = await button.textContent();
			expect(hasLabel || hasText).toBeTruthy();
		}
	});
});
