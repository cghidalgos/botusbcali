import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_TARGET || "http://localhost:3000";

  // Base URL: Cuando npm run build se ejecuta, mode es "production"
  // Cuando npm run dev se ejecuta, mode es "development"
  // En producción usa "/" porque _APP_BASE_PATH middleware ya elimina /botusbcali
  const base = mode === "production" ? "/" : "/admin/";

  return {
    base,
    server: {
      host: "::",
      port: 8090,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
