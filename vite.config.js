import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    publicDir: 'Public', // Ensure this matches your directory case sensitivity
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo.png'],
            manifest: {
                name: 'MTG Forge',
                short_name: 'MTG Forge',
                description: 'Advanced MTG Collection Manager & Deck Builder',
                theme_color: '#111827',
                background_color: '#111827',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    {
                        src: 'logo.png', // Fallback to logo.png if specific icons aren't generated yet
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            scope: '/',
            workbox: {
                maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api/, /^\/bugs/, /^\/socket.io/],
                clientsClaim: true,
                skipWaiting: true,
                cleanupOutdatedCaches: true,
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
                runtimeCaching: [
                    {
                        urlPattern: ({ request }) => request.destination === 'image',
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 30 * 24 * 60 * 60,
                            },
                        },
                    },
                    {
                        urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'static-resources',
                        },
                    },
                ]
            },
            devOptions: {
                enabled: true,
                type: 'module',
                navigateFallback: '/index.html',
            }
        })
    ],
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
    },
    preview: {
        port: 4173,
        proxy: {
            '/api': 'http://localhost:3004',
            '/bugs': 'http://localhost:3004',
            '/socket.io': {
                target: 'ws://localhost:3004',
                ws: true
            }
        }
    }
})
