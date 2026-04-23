import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  base: "/",
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      "@": "/src",
    },
    dedupe: ["@stellar/stellar-base"],
  },
  optimizeDeps: {
    include: ["@stellar/stellar-base"],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.BACKEND_PORT || 8080}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        ws: true,
      },
    },
  },
});
