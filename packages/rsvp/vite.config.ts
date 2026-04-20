import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { rscFunctions, rscSsg } from 'rsc-utils'
import { defineConfig } from 'vite'
import { functionsConfig } from './src/rsc-functions'

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'rsc' },
      configPath: './wrangler.toml',
    }),
    rsc({
      entries: {
        client: './src/main.tsx',
        rsc: './src/worker.ts',
        ssr: 'rsc-utils/ssr',
      },
      serverHandler: false,
    }),
    react(),
    rscFunctions(functionsConfig),
    rscSsg({
      staticPaths: [
        '/admin/',
        '/admin/groups/',
        '/admin/import/',
        '/admin/events/',
      ],
    }),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
})
