import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,       // fixed frontend port
    strictPort: true, // will fail if 5173 is in use
    cors: false       // we handle CORS in backend
  },
  preview: {
    port: 4173
  }
});