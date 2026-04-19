import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    rsc({
      entries: {
        client: './src/main.tsx',
        rsc: './src/framework/rsc-dev-entry.ts',
        ssr: './src/entry.ssr.tsx',
      },
      serverHandler: false,
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
})
