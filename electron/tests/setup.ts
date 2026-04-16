/**
 * Test Setup
 * Global test configuration, mocks, and utilities
 */

import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';

// Mock Electron APIs
const mockElectron = {
	ipcRenderer: {
		invoke: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		send: vi.fn(),
	},
	app: {
		getPath: vi.fn((name: string) => `/mock/${name}`),
		getVersion: vi.fn(() => '1.0.0'),
		quit: vi.fn(),
	},
	shell: {
		openExternal: vi.fn(),
		openPath: vi.fn(),
	},
	clipboard: {
		writeText: vi.fn(),
		readText: vi.fn(),
	},
	nativeTheme: {
		shouldUseDarkColors: false,
	},
	safeStorage: {
		isEncryptionAvailable: vi.fn(() => true),
		encryptString: vi.fn((value: string) => Buffer.from(value, 'utf8')),
		decryptString: vi.fn((value: Buffer | string) =>
			Buffer.isBuffer(value) ? value.toString('utf8') : Buffer.from(value).toString('utf8')
		),
	},
	dialog: {
		showOpenDialog: vi.fn(),
		showSaveDialog: vi.fn(),
		showMessageBox: vi.fn(),
	},
	Notification: vi.fn().mockImplementation(() => ({
		show: vi.fn(),
		close: vi.fn(),
	})),
	Menu: {
		buildFromTemplate: vi.fn(),
		setApplicationMenu: vi.fn(),
	},
	Tray: vi.fn().mockImplementation(() => ({
		setToolTip: vi.fn(),
		setImage: vi.fn(),
		setContextMenu: vi.fn(),
	})),
};

// Set global electron mock
(globalThis as any).electron = mockElectron;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock ResizeObserver
class MockResizeObserver {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
Object.defineProperty(globalThis, 'ResizeObserver', {
	writable: true,
	value: MockResizeObserver,
});

// Mock IntersectionObserver
class MockIntersectionObserver {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
Object.defineProperty(globalThis, 'IntersectionObserver', {
	writable: true,
	value: MockIntersectionObserver,
});

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

// Base UI scroll-area expects getAnimations in test DOM.
if (!Element.prototype.getAnimations) {
	Object.defineProperty(Element.prototype, 'getAnimations', {
		configurable: true,
		value: vi.fn(() => []),
	});
}

// Mock localStorage
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
	value: localStorageMock,
});

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
	value: {
		randomUUID: vi.fn(() => 'mock-uuid-1234'),
		subtle: {
			digest: vi.fn(),
		},
	},
});

// Mock fetch
global.fetch = vi.fn();

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
	localStorageMock.getItem.mockClear();
	localStorageMock.setItem.mockClear();
	localStorageMock.removeItem.mockClear();
	localStorageMock.clear.mockClear();
});

// Export mocks for use in tests
export { mockElectron };
