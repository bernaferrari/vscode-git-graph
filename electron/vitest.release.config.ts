import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [tsconfigPaths(), react()],
    test: {
        environment: 'happy-dom',
        include: [
            'electron/**/*.test.ts',
            'electron/**/*.test.tsx',
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
        ],
        setupFiles: ['./tests/setup.ts'],
        globals: true,
    },
});
