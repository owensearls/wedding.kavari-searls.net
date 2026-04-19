import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { defineConfig } from 'vite'
import { adminSpaFallback } from './src/vite/admin-spa-fallback'

export default defineConfig({
  plugins: [
    rsc({
      entries: { rsc: './src/entry.rsc.ts' },
      serverHandler: false,
    }),
    adminSpaFallback(),
    react(),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'index.html'),
            admin: resolve(__dirname, 'admin/index.html'),
          },
        },
      },
    },
  },
})
