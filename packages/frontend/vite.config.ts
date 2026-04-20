import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { rscBrowser } from 'rsc-utils'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [rscBrowser(), react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
})
