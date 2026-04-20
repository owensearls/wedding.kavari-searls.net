declare module 'virtual:rsc-utils/functions/modules' {
  export const modules: Record<string, Record<string, Record<string, unknown>>>
}

declare module 'virtual:rsc-utils/ssg-entry' {
  export function getStaticPaths(): string[]
}

declare module 'virtual:rsc-utils/static-pages/manifest' {
  import type { ComponentType } from 'react'
  export const pages: Array<{
    pathname: string
    entryName: string
    Component: ComponentType<{ url: URL }>
  }>
}
