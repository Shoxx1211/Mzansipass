import path from "node:path";

import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import {
  defineConfig,
} from "vite";
import {
  VitePWA,
} from "vite-plugin-pwa";

export default defineConfig(
  ({ mode }) => {
    const isProduction =
      mode === "production";

    return {
      base: "./",

      plugins: [
        react(),

        // HTTPS remains useful for testing browser APIs such as
        // geolocation from devices on the local network.
        basicSsl(),

        VitePWA({
          registerType:
            "autoUpdate",

          /*
           * VitePWA owns service-worker registration.
           * Pulse must not manually register another worker
           * from index.html or src/index.tsx.
           */
          injectRegister:
            "auto",

          includeAssets: [
            "favicon.ico",
            "apple-touch-icon.png",
            "robots.txt",
          ],

          /*
           * No development service worker.
           *
           * This removes the dev-sw.js SSL/certificate noise
           * while keeping the production PWA intact.
           */
          devOptions: {
            enabled: false,
          },

          manifest: {
            id: "/",

            name:
              "Pulse Transit",

            short_name:
              "Pulse",

            description:
              "Commuter intelligence for South Africa",

            theme_color:
              "#3b82f6",

            background_color:
              "#040816",

            display:
              "standalone",

            orientation:
              "portrait",

            scope:
              "/",

            start_url:
              "/",

            lang:
              "en-ZA",

            icons: [
              {
                src:
                  "/icons/pulse-192.png",
                sizes:
                  "192x192",
                type:
                  "image/png",
              },
              {
                src:
                  "/icons/pulse-512.png",
                sizes:
                  "512x512",
                type:
                  "image/png",
              },
            ],
          },

          workbox: {
            cleanupOutdatedCaches:
              true,

            clientsClaim:
              true,

            skipWaiting:
              true,

            globPatterns: [
              "**/*.{js,css,html,ico,png,svg,woff2}",
            ],

            runtimeCaching: [
              {
                urlPattern:
                  /^https:\/\/api\.pulse-transit\.app\/.*/i,

                handler:
                  "NetworkFirst",

                options: {
                  cacheName:
                    "pulse-api-cache",

                  networkTimeoutSeconds:
                    10,

                  expiration: {
                    maxEntries:
                      50,

                    maxAgeSeconds:
                      60 *
                      60 *
                      24,
                  },
                },
              },

              {
                urlPattern:
                  /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,

                handler:
                  "CacheFirst",

                options: {
                  cacheName:
                    "pulse-image-cache",

                  expiration: {
                    maxEntries:
                      100,

                    maxAgeSeconds:
                      60 *
                      60 *
                      24 *
                      7,
                  },
                },
              },
            ],
          },
        }),
      ],

      resolve: {
        alias: {
          "@":
            path.resolve(
              __dirname,
              "./src",
            ),

          "@components":
            path.resolve(
              __dirname,
              "./src/components",
            ),

          "@services":
            path.resolve(
              __dirname,
              "./src/services",
            ),

          "@hooks":
            path.resolve(
              __dirname,
              "./src/hooks",
            ),

          "@utils":
            path.resolve(
              __dirname,
              "./src/utils",
            ),

          "@types":
            path.resolve(
              __dirname,
              "./src/types",
            ),

          "@constants":
            path.resolve(
              __dirname,
              "./src/constants",
            ),

          "@assets":
            path.resolve(
              __dirname,
              "./src/assets",
            ),
        },

        dedupe: [
          "react",
          "react-dom",
        ],
      },

      server: {
        proxy: {
          "/api": {
            target: process.env.PULSE_BACKEND_PROXY_TARGET || "http://127.0.0.1:5000",
            changeOrigin: true,
            secure: false,
            rewrite: (path: string) => path.replace(/^\\/api/, ""),
          },
        },
        port:
          5173,

        strictPort:
          true,

        https:
          {},

        host:
          true,

        open:
          true,
      },

      preview: {
        port:
          4173,

        https:
          {},
      },

      build: {
        target:
          "esnext",

        sourcemap:
          false,

        chunkSizeWarningLimit:
          1000,

        minify:
          "terser",

        terserOptions: {
          compress: {
            drop_console:
              isProduction,

            drop_debugger:
              true,
          },
        },

        rollupOptions: {
          output: {
            manualChunks: {
              vendor: [
                "react",
                "react-dom",
                "react-router-dom",
              ],

              ui: [
                "framer-motion",
                "lucide-react",
              ],

              utils: [
                "date-fns",
                "clsx",
                "swr",
                "zustand",
              ],
            },
          },
        },
      },
    };
  },
);