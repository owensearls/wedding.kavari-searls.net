export type CorsOptions = {
  origin: string | string[]
  methods?: string[]
  headers?: string[]
}

export type NamespaceConfig = {
  name: string
  glob: string
  buildStub?: boolean
  cors?: CorsOptions
  // Override the URL prefix for this namespace. Defaults to Vite's
  // config.base. Set to '/' for namespaces served cross-origin from a
  // consumer whose Vite base differs.
  basename?: string
}

export type FunctionsConfig = {
  namespaces: NamespaceConfig[]
}
