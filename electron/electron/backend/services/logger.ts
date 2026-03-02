/**
 * Logger
 * Ported from git-graph/src/logger.ts
 * Provides logging for the Electron application
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { Disposable, toDisposable } from '../../../src/lib/utils/disposable';

const DOUBLE_QUOTE_REGEXP = /"/g;

/**
 * Manages logging for the Git Graph Electron application.
 */
export class Logger extends Disposable {
	private readonly logPath: string;
	private readonly enabled: boolean;

	constructor(enabled: boolean = true) {
		super();
		this.enabled = enabled;

		const logsDir = app.getPath('logs');
		if (!fs.existsSync(logsDir)) {
			fs.mkdirSync(logsDir, { recursive: true });
		}

		this.logPath = path.join(logsDir, 'git-graph.log');

		// Clear or create log file
		fs.writeFileSync(this.logPath, '');

		this.registerDisposable(
			toDisposable(() => {
				// Nothing to dispose
			})
		);
	}

	/**
	 * Log a message.
	 */
	public log(message: string): void {
		if (!this.enabled) return;

		const timestamp = this.getTimestamp();
		const line = `[${timestamp}] ${message}\n`;

		console.log(line.trim());
		fs.appendFileSync(this.logPath, line);
	}

	/**
	 * Log the execution of a spawned command.
	 */
	public logCmd(cmd: string, args: string[]): void {
		this.log('> ' + cmd + ' ' + args.map((arg) => arg === ''
			? '""'
			: arg.startsWith('--format=')
				? '--format=...'
				: arg.includes(' ')
					? '"' + arg.replace(DOUBLE_QUOTE_REGEXP, '\\"') + '"'
					: arg
		).join(' '));
	}

	/**
	 * Log an error message.
	 */
	public logError(message: string): void {
		this.log(`ERROR: ${message}`);
	}

	/**
	 * Get the log file path.
	 */
	public getLogPath(): string {
		return this.logPath;
	}

	/**
	 * Get formatted timestamp.
	 */
	private getTimestamp(): string {
		const date = new Date();
		const year = date.getFullYear();
		const month = pad2(date.getMonth() + 1);
		const day = pad2(date.getDate());
		const hours = pad2(date.getHours());
		const minutes = pad2(date.getMinutes());
		const seconds = pad2(date.getSeconds());
		const ms = pad3(date.getMilliseconds());
		return `${String(year)}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
	}
}

function pad2(n: number): string {
	return `${n > 9 ? '' : '0'}${String(n)}`;
}

function pad3(n: number): string {
	return `${n > 99 ? '' : n > 9 ? '0' : '00'}${String(n)}`;
}

// Singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(enabled: boolean = true): Logger {
	if (!loggerInstance) {
		loggerInstance = new Logger(enabled);
	}
	return loggerInstance;
}

export function resetLogger(): void {
	loggerInstance = null;
}
