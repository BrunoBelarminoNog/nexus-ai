import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: { tsconfigPaths: true },
    test: {
        globals: true,
        root: '../..',
        include: ['tests/integration/**/*.integration-spec.ts'],
        fileParallelism: false,
        hookTimeout: 120_000,
        testTimeout: 30_000,
    },
});