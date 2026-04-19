import type { Plugin } from 'vite'

// In dev, Vite's default SPA fallback only knows about the root index.html.
// For our two-SPA layout, nested routes under /admin/ (e.g. /admin/groups)
// must serve /admin/index.html so the admin React app can mount and handle
// the route client-side.
export function adminSpaFallback(): Plugin {
  return {
    name: 'admin-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? ''
        // Match /admin/<anything> but NOT /admin/ (already correct) and NOT
        // any path that looks like an asset (has a dot in the final segment).
        if (url.startsWith('/admin/') && url !== '/admin/') {
          const pathOnly = url.split('?')[0]
          const lastSegment = pathOnly.split('/').pop() ?? ''
          const looksLikeAsset = lastSegment.includes('.')
          if (!looksLikeAsset) {
            req.url = `/admin/${url.includes('?') ? `?${url.split('?')[1]}` : ''}`
          }
        }
        next()
      })
    },
  }
}
