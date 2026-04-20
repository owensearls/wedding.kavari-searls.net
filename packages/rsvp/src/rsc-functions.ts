import type { FunctionsConfig } from 'rsc-utils'

export const functionsConfig = {
  namespaces: [
    {
      name: 'public',
      glob: 'src/server/public/*.ts',
      buildStub: true,
      cors: { origin: '*' },
      // Consumed cross-origin by the frontend package; served at the
      // worker root independent of the admin app's Vite base.
      basename: '/',
    },
    { name: 'admin', glob: 'src/server/admin/*.ts' },
  ],
} satisfies FunctionsConfig
