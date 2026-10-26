import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    /**
     * PWA (Fase 2): el "service worker" guarda la aplicación (HTML, JS, CSS, íconos) en la
     * caché del navegador para que abra sin conexión. Los DATOS offline no van aquí: el
     * catálogo y las operaciones pendientes se guardan en IndexedDB (src/offline/).
     * En `npm run dev` el service worker está apagado; se prueba con `npm run build` + `npm run preview`.
     */
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fashionstore.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FashionStore',
        short_name: 'FashionStore',
        description: 'Tienda, punto de venta y gestión para negocios de moda. Funciona sin conexión.',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ad3e68',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cualquier ruta de la app (/dashboard/..., /t/:slug/tienda) abre index.html sin conexión.
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
