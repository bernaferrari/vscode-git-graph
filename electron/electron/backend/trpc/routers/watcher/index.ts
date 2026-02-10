/**
 * File Watcher tRPC Router
 * Provides real-time file change notifications to the renderer
 */

import { z } from 'zod';
import { publicProcedure, router } from '../../init';
import { observable } from '@trpc/server/observable';

// Simple event emitter for file changes
type ChangeListener = (repo: string) => void;
const listeners = new Set<ChangeListener>();

/**
 * Notify all subscribers that a repo has changed
 */
export function notifyRepoChanged(repo: string): void {
	listeners.forEach((listener) => {
		try {
			listener(repo);
		} catch {
			// Ignore errors
		}
	});
}

export const watcherRouter = router({
	/**
	 * Subscribe to file change events for a repository
	 */
	onChange: publicProcedure
		.input(z.object({ repo: z.string() }))
		.subscription(({ input }) => {
			return observable<string>((emit) => {
				const handler: ChangeListener = (changedRepo) => {
					if (changedRepo === input.repo) {
						emit.next(changedRepo);
					}
				};

				listeners.add(handler);

				return () => {
					listeners.delete(handler);
				};
			});
		}),
});
