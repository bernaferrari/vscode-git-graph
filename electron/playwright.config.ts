/**
 * E2E Test Configuration
 * Playwright configuration for end-to-end testing against the built Electron app.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: 'html',
	...(process.env.CI ? { workers: 1 } : {}),
	use: {
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
});
