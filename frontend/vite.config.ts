import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [
    react(),

    // 🔐 Enables HTTPS (REQUIRED for GPS)
    basicSsl(),

    VitePWA({
      registerType: "autoUpdate",

      devOptions: {
        enabled: true
      },

      manifest: {
        id: "/",
        name: "MzansiPass",
        short_name: "Mzansi",
        description: "AI-powered commuter intelligence",

        theme_color: "#0f172a",
        background_color: "#000000",

        display: "standalone",
        orientation: "portrait",

        scope: "/",
        start_url: "/",

        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },

      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          }
        ]
      },

      injectRegister: "auto"
    })
  ],

  resolve: {
    dedupe: ["react", "react-dom"]
  },

  // 🔥 THIS IS THE IMPORTANT FIX
  server: {
    port: 5173,
    strictPort: true,
    https: {} // ✅ FIXED (was `true`)
  },

  preview: {
    port: 4173,
    https: {} // ✅ also needed for preview
  },

  build: {
    target: "esnext",
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  }
});