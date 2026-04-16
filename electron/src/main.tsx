import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import DevTools from '@/web/components/utils/devtools';
import Providers from '@/web/lib/providers';
import { trpcClient } from '@/web/lib/trpcClient';
import { router } from '@/web/router';

import '@/web/styles/index.css';
import { useAppStore } from '@/lib/store';

const isDev = import.meta.env.DEV;

const rootElement = document.getElementById('root');

function reportRendererRuntimeError(source: string, reason: unknown): void {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error(`[renderer][${source}]`, reason);
    useAppStore.getState().setError(`${source}: ${message}`);
}

window.addEventListener('unhandledrejection', (event) => {
    // Prevent noisy default console handling and centralize reporting.
    event.preventDefault();
    reportRendererRuntimeError('unhandledrejection', event.reason);
});

window.addEventListener('error', (event) => {
    reportRendererRuntimeError('error', event.error ?? event.message);
});

function waitForFirstPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                resolve();
            });
        });
    });
}

if (rootElement) {
    createRoot(rootElement).render(
        <StrictMode>
            <Providers>
                <RouterProvider router={router} />
                <Toaster richColors position='bottom-right' />
                {isDev && <DevTools router={router} />}
            </Providers>
        </StrictMode>
    );

    // Signal main after React has had a chance to paint the first frame.
    void waitForFirstPaint()
        .then(() => trpcClient.system.signalReady.mutate())
        .catch((error: unknown) => {
            console.warn('[window] Failed to send ready signal:', error);
        });
}
