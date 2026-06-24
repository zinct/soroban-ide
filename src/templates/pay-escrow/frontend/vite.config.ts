import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // The Stellar SDK uses Node-style globals in some branches; this keeps the
    // browser bundle happy without pulling in extra polyfills.
    global: "globalThis",
  },
});
