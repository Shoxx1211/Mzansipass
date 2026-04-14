import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 👇 IMPORTANT: import WITHOUT types conflict
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  return {
    plugins: [
      react(),

      // 💎 PWA (typed safely)
      VitePWA({
        registerType: "autoUpdate",

        manifest: {
          name: "MzansiPass",
          short_name: "Mzansi",
          description: "Smart commuter tracking for South Africa",
          theme_color: "#2563eb",
          background_color: "#0f172a",
          display: "standalone",

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
            }
          ]
        },

        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*/,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24
                }
              }
            }
          ]
        }
      }) as any // 🔥 FORCE FIX TYPE CONFLICT
    ],

    resolve: {
      dedupe: ["react", "react-dom"]
    },

    server: {
      port: 5173,
      strictPort: true
    },

    preview: {
      port: 4173
    }
  };
});