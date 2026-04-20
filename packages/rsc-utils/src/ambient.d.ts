declare module 'virtual:rsc-utils/functions/modules' {
  export const modules: Record<string, Record<string, Record<string, unknown>>>
}

declare module 'virtual:rsc-utils/ssg-entry' {
  export function getStaticPaths(): string[]
}
