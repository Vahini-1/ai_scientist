import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_BACKEND_URL || "http://localhost:8787";
  const enableComponentTagger = env.VITE_ENABLE_COMPONENT_TAGGER === "true";

  return ({
  server: {
    // IPv6 host binding can crash on some Node/runtime setups.
    host: "127.0.0.1",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/health": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  // `lovable-tagger` currently emits deprecated/invalid optimizer options with Vite 8.
  // Keep it opt-in so local dev remains stable.
  plugins: [react(), mode === "development" && enableComponentTagger && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
});
