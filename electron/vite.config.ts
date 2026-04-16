import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vite.dev/config/
export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) {
                        return;
                    }

                    if (id.includes('@pierre/diffs')) {
                        return 'vendor-diff-renderer';
                    }

                    if (
                        id.includes('@tanstack/react-router') ||
                        id.includes('@tanstack/router-core') ||
                        id.includes('@tanstack/react-query') ||
                        id.includes('@tanstack/query-core') ||
                        id.includes('@trpc/client') ||
                        id.includes('@trpc/react-query') ||
                        id.includes('@trpc/server')
                    ) {
                        return 'vendor-tanstack-trpc';
                    }

                    if (
                        id.includes('@shikijs') ||
                        id.includes('shiki') ||
                        id.includes('vscode-oniguruma') ||
                        id.includes('vscode-textmate')
                    ) {
                        return 'vendor-syntax-highlight';
                    }

                    if (id.includes('date-fns')) {
                        return 'vendor-date';
                    }

                    if (id.includes('sonner')) {
                        return 'vendor-feedback';
                    }

                    if (id.includes('lucide-react') || id.includes('react-icons')) {
                        return 'vendor-icons';
                    }
                },
            },
        },
    },
    plugins: [
        tsconfigPaths(),
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
        }),

        react({
            babel: {
                plugins: [['babel-plugin-react-compiler']],
            },
        }),
        tailwindcss(),
        electron({
            main: {
                entry: 'electron/main.ts',
                vite: {
                    plugins: [tsconfigPaths()],
                },
            },
            preload: {
                input: 'electron/preload.ts',
            },
        }),
    ],
});
