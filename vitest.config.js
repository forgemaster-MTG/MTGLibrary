
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['server/tests/**/*.test.js'],
        alias: {
            '@': './server'
        },
        coverage: {
            reporter: ['text', 'json', 'html'],
        },
    },
});
