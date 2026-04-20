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
}

export type FunctionsConfig = {
  namespaces: NamespaceConfig[]
}
