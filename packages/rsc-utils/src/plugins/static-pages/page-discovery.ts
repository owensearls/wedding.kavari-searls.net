import path from 'node:path'

export type PageEntry = {
  pathname: string
  entryName: string
  absPath: string
}

export type DiscoverOptions = {
  projectRoot: string
  basename: string
  pages: Record<string, string>
}

export function discoverPages(options: DiscoverOptions): PageEntry[] {
  const basename = ensureTrailingSlash(ensureLeadingSlash(options.basename))
  const entries: PageEntry[] = []
  const seen = new Set<string>()
  let i = 0

  for (const [rawPath, modulePath] of Object.entries(options.pages)) {
    const pathname = normalizePathname(basename, rawPath)
    if (seen.has(pathname)) {
      throw new Error(
        `[rsc-utils:static-pages] duplicate page URL ${pathname}`
      )
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

function normalizePathname(basename: string, raw: string): string {
  let p = raw.trim()
  if (!p) return basename
  if (!p.startsWith('/')) p = '/' + p
  // Always merge with basename if raw doesn't already include it.
  if (basename !== '/' && !p.startsWith(basename.replace(/\/$/, ''))) {
    p = basename.replace(/\/$/, '') + p
  }
  if (!p.endsWith('/')) {
    // Keep no trailing slash — emit .html sibling
    return p
  }
  return p
}

function ensureLeadingSlash(s: string): string {
  return s.startsWith('/') ? s : `/${s}`
}

function ensureTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`
}
