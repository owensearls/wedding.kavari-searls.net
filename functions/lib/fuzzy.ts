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

// One guest-row candidate the lookup query can match against. Flattened from
// the DB join so the aggregation is pure and unit-testable.
export interface LookupCandidate {
  guestId: string
  displayName: string
  firstName: string
  lastName: string | null
  email: string | null
  groupId: string
  groupLabel: string
  inviteCode: string
}

export interface AggregatedLookupMatch {
  guestGroupId: string
  inviteCode: string
  label: string
  guestNames: string[]
}

// Group candidates that score > 0 by their guest_group, return the top-N by
// best score descending. Only guest names that actually scored are surfaced,
// so the UI can show the caller which person it matched on.
export function aggregateLookupMatches(
  candidates: LookupCandidate[],
  query: string,
  limit = 8,
): AggregatedLookupMatch[] {
  const byGroup = new Map<
    string,
    {
      groupId: string
      groupLabel: string
      inviteCode: string
      bestScore: number
      guestNames: Set<string>
    }
  >()

  for (const row of candidates) {
    const fullName =
      `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || row.displayName
    const candidateText = [row.displayName, fullName, row.email]
      .filter(Boolean)
      .join(' ')
    const s = score(query, candidateText)
    if (s <= 0) continue

    const existing = byGroup.get(row.groupId)
    if (existing) {
      existing.bestScore = Math.max(existing.bestScore, s)
      existing.guestNames.add(row.displayName)
    } else {
      byGroup.set(row.groupId, {
        groupId: row.groupId,
        groupLabel: row.groupLabel,
        inviteCode: row.inviteCode,
        bestScore: s,
        guestNames: new Set([row.displayName]),
      })
    }
  }

  return [...byGroup.values()]
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, limit)
    .map((m) => ({
      guestGroupId: m.groupId,
      inviteCode: m.inviteCode,
      label: m.groupLabel,
      guestNames: [...m.guestNames],
    }))
}
