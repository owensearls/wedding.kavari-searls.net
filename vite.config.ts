import { cloudflare } from "@cloudflare/vite-plugin";
import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { adminSpaFallback } from "./src/vite/admin-spa-fallback";

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: "rsc" },
      configPath: "./wrangler.toml",
    }),
    rsc({
      entries: {
        rsc: "./src/worker.ts",
      },
      serverHandler: false,
    }),
    adminSpaFallback(),
    react(),
  ],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, "index.html"),
            admin: resolve(__dirname, "admin/index.html"),
          },
        },
      },
    },
  },
});
