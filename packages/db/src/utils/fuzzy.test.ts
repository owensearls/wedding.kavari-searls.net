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

  it('keeps apostrophes and hyphens in names', () => {
    expect(normalize("O'Brien-Smith")).toBe("o'brien-smith")
  })

  it('strips other punctuation (including @ and .) so names cant be looked up by email', () => {
    expect(normalize('Alice!!! Smith?')).toBe('alice smith')
    expect(normalize('foo@bar.com')).toBe('foo bar com')
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
      inviteCode: 'alice01',
      partyLeaderId: 'g1',
      groupLabel: 'The Smith family',
    },
    {
      guestId: 'g2',
      displayName: 'Bob Smith',
      firstName: 'Bob',
      lastName: 'Smith',
      inviteCode: 'bob0002',
      partyLeaderId: 'g1',
      groupLabel: 'The Smith family',
    },
    {
      guestId: 'g3',
      displayName: 'Jordan Lee',
      firstName: 'Jordan',
      lastName: 'Lee',
      inviteCode: 'jordn22',
      partyLeaderId: 'g3',
      groupLabel: 'Jordan & guest',
    },
  ]

  it('returns empty array when nothing matches', () => {
    expect(aggregateLookupMatches(candidates, 'zzzzz')).toEqual([])
  })

  it('does not match by email (lookup-by-email is disabled)', () => {
    // The local-part is "uniqueprefix" — present nowhere in any guest's
    // name — so typing the email finds nothing. Matching on the host part
    // ("example.com") would expose membership.
    expect(
      aggregateLookupMatches(candidates, 'uniqueprefix@example.com')
    ).toEqual([])
  })

  it("matches by last name, dedupes into one group, uses best scorer's code", () => {
    const result = aggregateLookupMatches(candidates, 'bob smith')
    expect(result).toHaveLength(1)
    expect(result[0].inviteCode).toBe('bob0002')
    expect(result[0].guestNames.sort()).toEqual(['Alice Smith', 'Bob Smith'])
  })

  it('matches by first name', () => {
    const result = aggregateLookupMatches(candidates, 'Jordan')
    expect(result).toHaveLength(1)
    expect(result[0].inviteCode).toBe('jordn22')
    expect(result[0].guestNames).toEqual(['Jordan Lee'])
  })

  it('sorts multiple matching groups by best score descending', () => {
    const result = aggregateLookupMatches(
      [
        ...candidates,
        {
          guestId: 'g4',
          displayName: 'Alison Kavari',
          firstName: 'Alison',
          lastName: 'Kavari',
          inviteCode: 'kvri33',
          partyLeaderId: 'g4',
          groupLabel: 'The Kavari family',
        },
      ],
      'Alice Smith'
    )
    // Alice Smith is an exact match; should score highest.
    expect(result[0].inviteCode).toBe('alice01')
  })

  it('respects the limit', () => {
    const many: LookupCandidate[] = Array.from({ length: 20 }, (_, i) => ({
      guestId: `g${i}`,
      displayName: `Alice ${i}`,
      firstName: 'Alice',
      lastName: String(i),
      inviteCode: `code${i}`,
      partyLeaderId: `g${i}`,
      groupLabel: `Group ${i}`,
    }))
    const result = aggregateLookupMatches(many, 'alice', 5)
    expect(result).toHaveLength(5)
  })
})
