import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    publicDir: 'Public',
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3004',
            '/bugs': 'http://localhost:3004',
            '/socket.io': {
                target: 'ws://localhost:3004',
                ws: true
            }
        },
        open: true
    }
})
