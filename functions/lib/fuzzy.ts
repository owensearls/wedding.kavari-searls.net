// Light fuzzy matching for guest lookup. Normalizes and ranks by token overlap.

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9@.\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokens(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean)
}

// Score a candidate (e.g. "Sanam Kavari" or "owen@searls.net") against a query.
// Higher = better. 0 = no plausible match.
export function score(query: string, candidate: string): number {
  const q = normalize(query)
  const c = normalize(candidate)
  if (!q || !c) return 0

  // Exact email or full string equality is the strongest signal.
  if (q === c) return 1000

  // Substring match on the whole query.
  if (c.includes(q)) return 500 - (c.length - q.length)

  const qt = tokens(q)
  const ct = tokens(c)
  if (qt.length === 0 || ct.length === 0) return 0

  let matched = 0
  for (const qToken of qt) {
    if (ct.some((cToken) => cToken === qToken || cToken.startsWith(qToken))) {
      matched++
    }
  }

  if (matched === 0) return 0
  return matched * 50 + (matched === qt.length ? 100 : 0)
}
