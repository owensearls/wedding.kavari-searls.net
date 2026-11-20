import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { rscStaticPages } from 'rsc-utils'
import { defineConfig } from 'vite'

// `childEnvironments: ['ssr']` makes ssr a Cloudflare-runtime sibling of rsc
// so the deployed Worker bundles both module graphs in one upload. In dev
// that turns ssr into a CloudflareDevEnvironment with no Node-side runner,
// which breaks plugin-rsc's `loadModuleDevProxy` (it RPCs into
// `server.environments.ssr.runner.import(...)`). Limit the embed to the
// build pass so dev keeps ssr as a default Vite RunnableDevEnvironment.
export default defineConfig(({ command }) => ({
  plugins: [
    cloudflare({
      viteEnvironment:
        command === 'build'
          ? { name: 'rsc', childEnvironments: ['ssr'] }
          : { name: 'rsc' },
      configPath: './wrangler.toml',
    }),
    rsc({ serverHandler: false, loadModuleDevProxy: true }),
    react(),
    rscStaticPages({
      pages: {
        '/': './src/index.tsx',
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
  },
}))
