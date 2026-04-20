import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { rscFunctions, rscStaticPages } from 'rsc-utils'
import { defineConfig } from 'vite'
import { functionsConfig } from './src/rsc-functions'

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'rsc' },
      configPath: './wrangler.toml',
    }),
    rsc({ serverHandler: false }),
    react(),
    rscFunctions(functionsConfig),
    rscStaticPages({
      basename: '/admin/',
      pages: {
        '/admin/': './src/admin/index.tsx',
        '/admin/events/': './src/admin/events.tsx',
        '/admin/import/': './src/admin/import.tsx',
      },
    }),
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { index: './src/client-entry.tsx' },
        },
      },
    },
    rsc: {
      build: {
        rollupOptions: {
          input: { index: './src/worker.ts' },
        },
      },
    },
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
})
