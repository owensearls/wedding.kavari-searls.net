import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { rscFunctions, rscStaticPages } from 'rsc-utils'
import { defineConfig } from 'vite'
import { functionsConfig } from './src/rsc-functions'

export default defineConfig({
  base: '/admin/',
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'rsc' },
      configPath: './wrangler.toml',
      // Share local Miniflare/D1 state with the frontend worker so both apps
      // hit the same on-disk D1 in `pnpm dev`. Path is relative to this
      // package's vite root and points at the workspace-level `.wrangler/`.
      persistState: { path: '../../.wrangler/state' },
    }),
    rsc({ serverHandler: false, loadModuleDevProxy: true }),
    react(),
    rscFunctions(functionsConfig),
    rscStaticPages({
      pages: {
        '/': './src/admin/index.tsx',
        '/events/': './src/admin/events.tsx',
        '/import/': './src/admin/import.tsx',
      },
    }),
  ],
  environments: {
    client: {
      build: {
        outDir: 'dist/client/admin',
        rolldownOptions: {
          input: { index: './src/entry.client.ts' },
        },
      },
    },
    rsc: {
      build: {
        rolldownOptions: {
          input: { index: './src/entry.worker.ts' },
        },
      },
      optimizeDeps: {
        include: ['zod', 'kysely', 'kysely-d1'],
      },
    },
  },
})
