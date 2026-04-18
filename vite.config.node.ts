import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    rsc({
      entries: { rsc: "./src/entry.rsc.tsx" },
      serverHandler: false,
    }),
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
