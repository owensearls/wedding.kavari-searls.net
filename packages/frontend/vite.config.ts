import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { rscFunctions, rscStaticPages } from 'rsc-utils'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare({
      // Embed the `ssr` environment as a child of `rsc` so the deployed
      // Worker contains both module graphs in a single upload.
      // See https://developers.cloudflare.com/workers/vite-plugin/reference/api/
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      configPath: './wrangler.toml',
      // Share local Miniflare/D1 state with the rsvp worker so both apps
      // hit the same on-disk D1 in `pnpm dev`. Path is relative to this
      // package's vite root and points at the workspace-level `.wrangler/`.
      persistState: { path: '../../.wrangler/state' },
    }),
    rsc({ serverHandler: false, loadModuleDevProxy: true }),
    react(),
    rscFunctions(['src/server/*.ts']),
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
    // Nest ssr inside dist/rsc/ so the rsc entry's `await import("./ssr/...")`
    // resolves within the wrangler upload tree (the rsc plugin computes the
    // import path as the relative path between rsc.outDir and ssr.outDir).
    ssr: {
      build: {
        outDir: 'dist/rsc/ssr',
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})
