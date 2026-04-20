import type { FunctionsConfig } from 'rsc-utils'

export const functionsConfig = {
  namespaces: [
    {
      name: 'public',
      glob: 'src/server/public/*.ts',
      buildStub: true,
      cors: { origin: '*' },
    },
    { name: 'admin', glob: 'src/server/admin/*.ts' },
  ],
} satisfies FunctionsConfig
