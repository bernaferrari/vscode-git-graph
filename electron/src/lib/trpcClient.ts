import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc-experimental/renderer';

import type { AppRouter } from '@/app/backend/trpc/router';

type TrpcClient = ReturnType<typeof createTRPCProxyClient<AppRouter>>;

let cachedClient: TrpcClient | null = null;

function getClient(): TrpcClient {
	if (cachedClient) {
		return cachedClient;
	}
	if (!('electronTRPC' in globalThis)) {
		throw new Error('electronTRPC global unavailable');
	}
	cachedClient = createTRPCProxyClient<AppRouter>({ links: [ipcLink()] });
	return cachedClient;
}

// Vanilla tRPC client for use outside React components (e.g., in main.tsx)
export const trpcClient = new Proxy({} as TrpcClient, {
	get(_target: TrpcClient, key: string | symbol, receiver: unknown): unknown {
		return Reflect.get(getClient(), key, receiver);
	},
});
