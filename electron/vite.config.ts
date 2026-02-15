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
                        id.includes('@shikijs') ||
                        id.includes('shiki') ||
                        id.includes('vscode-oniguruma') ||
                        id.includes('vscode-textmate')
                    ) {
                        return 'vendor-syntax-highlight';
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
