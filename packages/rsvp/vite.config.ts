import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { defineConfig } from 'vite'
import { rscSsgPlugin } from './src/framework/ssg-plugin'

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
        ssr: './src/entry.ssr.tsx',
      },
      serverHandler: false,
    }),
    react(),
    rscSsgPlugin(),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
})
