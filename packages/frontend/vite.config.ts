import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { rscStaticPages } from 'rsc-utils'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    rsc({ serverHandler: false }),
    react(),
    rscStaticPages({
      pages: {
        '/': './src/index.tsx',
        '/rsvp': './src/rsvp/index.tsx',
      },
    }),
  ],
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: { index: './src/client-entry.tsx' },
        },
      },
    },
  },
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
