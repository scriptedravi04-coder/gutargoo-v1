import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// One build for the website (/) and the admin panel (/admin).
// In development the API server runs separately (npm run dev:server) and /api is forwarded to it.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@v": path.resolve(__dirname, "./src/viewer"),
      "@": path.resolve(__dirname, "./src/admin"),
    },
  },
  server: {
    port: 8080,
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } },
  },
  build: { outDir: "dist", chunkSizeWarningLimit: 1200 },
});
