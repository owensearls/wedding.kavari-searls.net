declare module 'virtual:rsc-utils/functions/modules' {
  export const modules: Record<string, Record<string, Record<string, unknown>>>
}

declare module 'virtual:rsc-utils/static-pages/manifest' {
  import type { ComponentType } from 'react'
  export const pages: Array<{
    pathname: string
    entryName: string
    Component: ComponentType<{ url: URL }>
  }>
}

declare module 'virtual:rsc-utils/static-pages/rsc-entry' {
  export function getStaticPaths(): string[]
  export function handleRequest(request: Request): Promise<{
    html: ReadableStream<Uint8Array>
    rsc: ReadableStream<Uint8Array>
  } | null>
}
