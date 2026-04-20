import type { Plugin } from 'vite'

/**
 * Shims `@vitejs/plugin-rsc/browser` so a plain-Vite SPA can consume
 * client stubs without registering the RSC plugin.
 *
 * Two transforms happen at the consumer's build step:
 *
 * 1. `virtual:vite-rsc/client-references` — plugin-rsc normally provides
 *    this virtual module. Here we stub it as an empty export.
 *
 * 2. `__webpack_require__` — the React Server DOM browser bundle uses
 *    webpack-style requires internally, which plugin-rsc normally rewrites.
 *    Without the plugin we apply the same rewrite manually.
 */
export function rscBrowser(): Plugin[] {
  return [clientReferencesStub(), webpackRequireShim()]
}

function clientReferencesStub(): Plugin {
  const virtualId = 'virtual:vite-rsc/client-references'
  const resolvedId = '\0' + virtualId
  return {
    name: 'rsc-utils:browser-client-references',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id === resolvedId) return 'export default {}'
    },
  }
}

function webpackRequireShim(): Plugin {
  return {
    name: 'rsc-utils:browser-require-shim',
    transform(code, id) {
      if (!id.includes('plugin-rsc') && !id.includes('react-server-dom')) {
        return
      }
      if (!code.includes('__webpack_require__')) return
      let next = code.replaceAll('__webpack_require__.u', '({}).u')
      next = next.replaceAll('__webpack_require__', '__vite_rsc_require__')
      return { code: next, map: null }
    },
  }
}
