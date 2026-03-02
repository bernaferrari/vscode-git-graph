import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [tsconfigPaths(), react()],
    test: {
        environment: 'happy-dom',
        include: [
            'electron/__tests__/security.test.ts',
            'electron/__tests__/csp.test.ts',
            'src/lib/utils/disposable.test.ts',
            'src/lib/utils/event.test.ts',
            'src/components/git-graph/issue-tracker.test.ts',
            'src/components/git-graph/signing-config.test.tsx',
            'src/components/git-graph/command-palette.test.tsx',
        ],
        setupFiles: ['./tests/setup.ts'],
        globals: true,
    },
});
