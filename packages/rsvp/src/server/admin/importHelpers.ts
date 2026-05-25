export function findUnknownEventSlugs(
  rows: { events?: string | undefined }[],
  knownSlugs: Iterable<string>
): string[] {
  const known = new Set(knownSlugs)
  const unknown = new Set<string>()
  for (const row of rows) {
    if (!row.events) continue
    for (const slug of row.events
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!known.has(slug)) unknown.add(slug)
    }
  }
  return Array.from(unknown).sort()
}
