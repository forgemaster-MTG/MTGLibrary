
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom', // Default to jsdom for React components
        include: ['server/tests/**/*.test.js', 'src/**/*.test.{js,jsx}'],
        setupFiles: ['./src/test/setup.js'], // Setup for frontend
        alias: {
            '@': './src'
        },
        coverage: {
            reporter: ['text', 'json', 'html'],
            include: ['server/api/**/*.js', 'src/**/*.{js,jsx}'],
        },
    },
});
