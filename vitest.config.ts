import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'functions/**/*.test.ts',
      'shared/**/*.test.ts',
      'src/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    testTimeout: 60_000,
  },
})
