import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ipcLink } from 'electron-trpc-experimental/renderer';
import { AlertTriangle, MonitorCog } from 'lucide-react';

import { trpc } from '@/web/trpc/client';

import type { AppRouter } from '@/app/backend/trpc/router';

import type { TRPCClient } from '@trpc/client';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60,
            retry: 1,
        },
    },
});

let trpcClient: TRPCClient<AppRouter> | null = null;

function getTrpcClient(): TRPCClient<AppRouter> | null {
    if (!('electronTRPC' in globalThis)) {
        return null;
    }
    trpcClient ??= trpc.createClient({
        links: [ipcLink()],
    });
    return trpcClient;
}

interface TRPCProviderProps {
    children: ReactNode;
}

function BrowserRuntimeFallback(): ReactNode {
    return (
        <main className='bg-background text-foreground flex min-h-screen items-center justify-center p-6'>
            <section className='ui-surface w-full max-w-2xl p-5'>
                <div className='flex items-start gap-3'>
                    <div className='bg-[color-mix(in_oklch,var(--warning)_10%,transparent)] text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] dark:text-[color-mix(in_oklch,var(--warning)_72%,var(--foreground))] flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_oklch,var(--warning)_25%,transparent)]'>
                        <AlertTriangle className='h-5 w-5' />
                    </div>
                    <div className='min-w-0 space-y-3'>
                        <div>
                            <p className='text-base font-semibold'>Desktop runtime required</p>
                            <p className='text-muted-foreground mt-1 text-sm'>
                                Git Graph uses Electron IPC for repository access. The browser preview can load the shell, but repository
                                actions need the desktop preload bridge.
                            </p>
                        </div>
                        <div className='border-border/70 bg-muted/25 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm'>
                            <MonitorCog className='text-muted-foreground h-4 w-4' />
                            <span>Open the Electron app window to review live repositories and feature screens.</span>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}

export function TRPCProvider({ children }: TRPCProviderProps): ReactNode {
    const client = getTrpcClient();
    if (!client) {
        return <BrowserRuntimeFallback />;
    }

    return (
        <trpc.Provider client={client} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
}
