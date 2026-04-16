import * as electron from 'electron';

import { appStore } from '@/app/backend/store';

export interface SecretVaultState {
	version: 1;
	entries: Record<string, string>;
}

const SECRET_VAULT_KEY = 'secretVault';
const ephemeralSecrets = new Map<string, string>();

interface SafeStorageLike {
	isEncryptionAvailable: () => boolean;
	encryptString: (value: string) => Buffer;
	decryptString: (value: Buffer) => string;
}

const safeStorage = (
	(electron as {
		safeStorage?: SafeStorageLike;
	}).safeStorage ??
	((globalThis as { electron?: { safeStorage?: SafeStorageLike } }).electron?.safeStorage)
);

function isEncryptionAvailable(): boolean {
	return typeof safeStorage?.isEncryptionAvailable === 'function' ? safeStorage.isEncryptionAvailable() : false;
}

function normalizeVault(value: unknown): SecretVaultState {
	if (!value || typeof value !== 'object') {
		return {
			version: 1,
			entries: {},
		};
	}

	const rawEntries = (value as { entries?: unknown }).entries;
	const entries =
		rawEntries && typeof rawEntries === 'object' && !Array.isArray(rawEntries)
			? Object.fromEntries(
					Object.entries(rawEntries).filter(([, entry]) => typeof entry === 'string')
				)
			: {};

	return {
		version: 1,
		entries,
	};
}

function readVault(): SecretVaultState {
	return normalizeVault(appStore.get(SECRET_VAULT_KEY));
}

function writeVault(vault: SecretVaultState): void {
	appStore.set(SECRET_VAULT_KEY, vault);
}

function encryptSecret(value: string): string {
	if (!safeStorage) {
		throw new Error('Encrypted secret storage is not available.');
	}
	const encrypted = safeStorage.encryptString(value);
	return Buffer.from(encrypted).toString('base64');
}

function decryptSecret(value: string): string {
	if (!safeStorage) {
		throw new Error('Encrypted secret storage is not available.');
	}
	return safeStorage.decryptString(Buffer.from(value, 'base64'));
}

export function getSecretValue(key: string): string | null {
	if (ephemeralSecrets.has(key)) {
		return ephemeralSecrets.get(key) ?? null;
	}

	if (!isEncryptionAvailable()) {
		return null;
	}

	const vault = readVault();
	const storedValue = vault.entries[key];
	if (!storedValue) {
		return null;
	}

	try {
		return decryptSecret(storedValue);
	} catch {
		return null;
	}
}

export function hasSecretValue(key: string): boolean {
	return getSecretValue(key) !== null;
}

export function setSecretValue(key: string, value: string | null | undefined): void {
	const normalized = typeof value === 'string' ? value.trim() : '';
	if (!normalized) {
		deleteSecretValue(key);
		return;
	}

	if (!isEncryptionAvailable()) {
		ephemeralSecrets.set(key, normalized);
		return;
	}

	ephemeralSecrets.delete(key);
	const vault = readVault();
	vault.entries[key] = encryptSecret(normalized);
	writeVault(vault);
}

export function deleteSecretValue(key: string): void {
	ephemeralSecrets.delete(key);

	if (!isEncryptionAvailable()) {
		return;
	}

	const vault = readVault();
	if (vault.entries[key] === undefined) {
		return;
	}

	delete vault.entries[key];
	writeVault(vault);
}

export function readSecretValue(key: string, legacyValue?: string | null): string {
	const stored = getSecretValue(key);
	if (stored) {
		return stored;
	}

	const normalizedLegacy = typeof legacyValue === 'string' ? legacyValue.trim() : '';
	if (normalizedLegacy) {
		setSecretValue(key, normalizedLegacy);
		return normalizedLegacy;
	}

	return '';
}
