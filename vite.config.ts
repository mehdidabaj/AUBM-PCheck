import path from "path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function stripCrossOrigin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, "");
    },
  };
}

export default defineConfig({
  root: path.resolve("client"),
  plugins: [react(), tailwindcss(), stripCrossOrigin()],
  resolve: {
    alias: {
      "@shared": path.resolve("shared"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8091",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve("dist/public"),
    emptyOutDir: true,
    modulePreload: false,
  },
});
