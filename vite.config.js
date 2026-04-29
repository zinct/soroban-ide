import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ mode }) => {
  // Load env from .env / .env.local / .env.<mode> without the default
  // `VITE_` prefix filter so we can read things like BACKEND_PORT that are
  // only used by the dev-server proxy (not shipped to the client).
  const env = loadEnv(mode, process.cwd(), "");
  const backendPort = env.BACKEND_PORT || process.env.BACKEND_PORT || "8080";

  return {
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
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          ws: true,
        },
      },
    },
  };
});
