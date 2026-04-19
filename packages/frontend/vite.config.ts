import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The rsvp stubs import from `@vitejs/plugin-rsc/browser`, which in turn
// imports `virtual:vite-rsc/client-references`.  That virtual module is
// normally provided by the RSC plugin, but the frontend is a plain SPA — we
// just need an empty stub so the import resolves at build time.
function rscClientReferencesStub(): Plugin {
  const virtualId = 'virtual:vite-rsc/client-references'
  const resolvedId = '\0' + virtualId
  return {
    name: 'rsc-client-references-stub',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id === resolvedId) return 'export default {}'
    },
  }
}

export default defineConfig({
  plugins: [rscClientReferencesStub(), react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
  },
})
