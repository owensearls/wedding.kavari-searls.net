import path from 'node:path'

export type PageEntry = {
  pathname: string
  entryName: string
  absPath: string
}

export type DiscoverOptions = {
  projectRoot: string
  pages: Record<string, string>
}

export function discoverPages(options: DiscoverOptions): PageEntry[] {
  const entries: PageEntry[] = []
  const seen = new Set<string>()
  let i = 0

  for (const [rawPath, modulePath] of Object.entries(options.pages)) {
    const pathname = normalizePathname(rawPath)
    if (seen.has(pathname)) {
      throw new Error(`[rsc-utils:static-pages] duplicate page URL ${pathname}`)
    }
    seen.add(pathname)
    entries.push({
      pathname,
      entryName: `page-${i++}`,
      absPath: path.resolve(options.projectRoot, modulePath),
    })
  }

  return entries
}

function normalizePathname(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
