import { describe, expect, it } from 'vitest'
import {
  aggregateLookupMatches,
  normalize,
  score,
  tokens,
  type LookupCandidate,
} from './fuzzy'

describe('normalize', () => {
  it('lowercases', () => {
    expect(normalize('Alice')).toBe('alice')
  })

  it('strips diacritics', () => {
    expect(normalize('Renée')).toBe('renee')
    expect(normalize('Müller')).toBe('muller')
    expect(normalize('María García-López')).toBe('maria garcia-lopez')
  })

  it('collapses whitespace and trims', () => {
    expect(normalize('  Alice   Smith  ')).toBe('alice smith')
  })

  it("keeps email-safe characters and apostrophes/hyphens", () => {
    expect(normalize('Foo@Bar.com')).toBe('foo@bar.com')
    expect(normalize("O'Brien-Smith")).toBe("o'brien-smith")
  })

  it('strips other punctuation', () => {
    expect(normalize('Alice!!! Smith?')).toBe('alice smith')
  })

  it('returns empty for blank input', () => {
    expect(normalize('   ')).toBe('')
    expect(normalize('')).toBe('')
  })
})

describe('tokens', () => {
  it('splits on whitespace', () => {
    expect(tokens('alice smith')).toEqual(['alice', 'smith'])
  })

  it('filters out empties', () => {
    expect(tokens('  alice   smith  ')).toEqual(['alice', 'smith'])
  })

  it('returns empty array for blank input', () => {
    expect(tokens('')).toEqual([])
  })
})

describe('score', () => {
  it('returns 1000 on exact match', () => {
    expect(score('owen@searls.net', 'owen@searls.net')).toBe(1000)
    expect(score('Alice Smith', 'alice smith')).toBe(1000)
  })

  it('scores substring matches between 400 and 500', () => {
    const s = score('alice', 'alice smith')
    expect(s).toBeGreaterThanOrEqual(400)
    expect(s).toBeLessThan(500)
  })

  it('prefers shorter candidates on substring ties', () => {
    const closer = score('alice', 'alice smith')
    const farther = score('alice', 'alice smith jr iii extra extra')
    expect(closer).toBeGreaterThan(farther)
  })

  it('scores token-prefix matches without substring hit', () => {
    // No substring hit because "ali jon" is not contiguous in "alice smith jonas"
    expect(score('ali jon', 'alice smith jonas')).toBeGreaterThan(0)
  })

  it('rewards all-tokens-matched bonus', () => {
    // Normalized substring "al sm" isn't contiguous in "alice smith" (there's a
    // space but "al sm" with one space vs "alice smith" with one space and
    // more letters). So both fall through to token matching. Both tokens match.
    const both = score('al sm', 'alice smith')
    const one = score('al xyz', 'alice smith')
    expect(both).toBeGreaterThan(one)
  })

  it('returns 0 for unrelated strings', () => {
    expect(score('xyz', 'alice smith')).toBe(0)
    expect(score('', 'alice smith')).toBe(0)
    expect(score('alice', '')).toBe(0)
  })

  it('is case and accent insensitive', () => {
    expect(score('RENEE', 'Renée Kavari')).toBeGreaterThan(0)
  })
})

describe('aggregateLookupMatches', () => {
  const candidates: LookupCandidate[] = [
    {
      guestId: 'g1',
      displayName: 'Alice Smith',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      groupId: 'grpA',
      groupLabel: 'The Smith family',
      inviteCode: 'smith01',
    },
    {
      guestId: 'g2',
      displayName: 'Bob Smith',
      firstName: 'Bob',
      lastName: 'Smith',
      email: null,
      groupId: 'grpA',
      groupLabel: 'The Smith family',
      inviteCode: 'smith01',
    },
    {
      guestId: 'g3',
      displayName: 'Jordan Lee',
      firstName: 'Jordan',
      lastName: 'Lee',
      email: 'jordan@example.com',
      groupId: 'grpB',
      groupLabel: 'Jordan & guest',
      inviteCode: 'jordn22',
    },
  ]

  it('returns empty array when nothing matches', () => {
    expect(aggregateLookupMatches(candidates, 'zzzzz')).toEqual([])
  })

  it('matches by email', () => {
    const result = aggregateLookupMatches(candidates, 'alice@example.com')
    expect(result).toHaveLength(1)
    expect(result[0].inviteCode).toBe('smith01')
    expect(result[0].guestNames).toEqual(['Alice Smith'])
  })

  it('matches by last name and dedupes into one group', () => {
    const result = aggregateLookupMatches(candidates, 'smith')
    expect(result).toHaveLength(1)
    expect(result[0].inviteCode).toBe('smith01')
    // Both guests whose text scored > 0 should show up.
    expect(result[0].guestNames.sort()).toEqual(['Alice Smith', 'Bob Smith'])
  })

  it('matches by first name', () => {
    const result = aggregateLookupMatches(candidates, 'Jordan')
    expect(result).toHaveLength(1)
    expect(result[0].inviteCode).toBe('jordn22')
    expect(result[0].guestNames).toEqual(['Jordan Lee'])
  })

  it('sorts multiple matching groups by best score descending', () => {
    // "smith" only matches the Smith family; "lee" only matches Jordan Lee; but
    // if we search a query that lands in both groups with different strengths,
    // ordering should reflect the score. Use a query that exact-matches Jordan's
    // email (score 1000) and substring-matches nothing in the Smith family.
    const result = aggregateLookupMatches(
      [
        ...candidates,
        // Also substring-matches "alice"
        {
          guestId: 'g4',
          displayName: 'Alison Kavari',
          firstName: 'Alison',
          lastName: 'Kavari',
          email: null,
          groupId: 'grpC',
          groupLabel: 'The Kavari family',
          inviteCode: 'kvri33',
        },
      ],
      'alice@example.com',
    )
    // Alice's exact email beats anyone else — first result should be her group.
    expect(result[0].inviteCode).toBe('smith01')
  })

  it('respects the limit', () => {
    const many: LookupCandidate[] = Array.from({ length: 20 }, (_, i) => ({
      guestId: `g${i}`,
      displayName: `Alice ${i}`,
      firstName: 'Alice',
      lastName: String(i),
      email: null,
      groupId: `grp${i}`,
      groupLabel: `Group ${i}`,
      inviteCode: `code${i}`,
    }))
    const result = aggregateLookupMatches(many, 'alice', 5)
    expect(result).toHaveLength(5)
  })
})
