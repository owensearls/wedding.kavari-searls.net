import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { rscFunctions, rscStaticPages } from 'rsc-utils'
import { defineConfig } from 'vite'

// `childEnvironments: ['ssr']` makes ssr a Cloudflare-runtime sibling of rsc
// so the deployed Worker bundles both module graphs in one upload. In dev
// that turns ssr into a CloudflareDevEnvironment with no Node-side runner,
// which breaks plugin-rsc's `loadModuleDevProxy` (it RPCs into
// `server.environments.ssr.runner.import(...)`). Limit the embed to the
// build pass so dev keeps ssr as a default Vite RunnableDevEnvironment.
export default defineConfig(({ command }) => ({
  base: '/admin/',
  plugins: [
    cloudflare({
      viteEnvironment:
        command === 'build'
          ? { name: 'rsc', childEnvironments: ['ssr'] }
          : { name: 'rsc' },
      configPath: './wrangler.toml',
      // Share local Miniflare/D1 state with the frontend worker so both apps
      // hit the same on-disk D1 in `pnpm dev`. Path is relative to this
      // package's vite root and points at the workspace-level `.wrangler/`.
      persistState: { path: '../../.wrangler/state' },
    }),
    rsc({ serverHandler: false, loadModuleDevProxy: true }),
    react(),
    rscFunctions(['src/server/admin/*.ts']),
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
    // Nest ssr inside dist/rsc/ so the rsc entry's `await import("./ssr/...")`
    // resolves within the wrangler upload tree (the rsc plugin computes the
    // import path as the relative path between rsc.outDir and ssr.outDir).
    ssr: {
      build: {
        outDir: 'dist/rsc/ssr',
      },
    },
  },
}))
