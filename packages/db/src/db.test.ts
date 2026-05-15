import { describe, expect, it } from 'vitest'
import { newId, newInviteCode, nowIso } from './db'

describe('newId', () => {
  it('returns a hex-ish string without dashes when no prefix is given', () => {
    const id = newId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('includes the provided prefix', () => {
    const id = newId('grp')
    expect(id).toMatch(/^grp_[0-9a-f]{32}$/)
  })

  it('produces unique values across many calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(newId())
    expect(seen.size).toBe(500)
  })
})

describe('newInviteCode', () => {
  const ALPHABET = /^[23456789abcdefghjkmnpqrstuvwxyz]+$/

  it('defaults to 8 characters from the safe alphabet', () => {
    const code = newInviteCode()
    expect(code).toHaveLength(8)
    expect(code).toMatch(ALPHABET)
  })

  it('honors custom length', () => {
    expect(newInviteCode(4)).toHaveLength(4)
    expect(newInviteCode(12)).toHaveLength(12)
  })

  it('never contains visually ambiguous characters (0 1 i l o)', () => {
    for (let i = 0; i < 200; i++) {
      const code = newInviteCode(12)
      expect(code).not.toMatch(/[01ilo]/)
    }
  })

  it('produces high-entropy unique codes in practice', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(newInviteCode(10))
    // Accept <= 1 collision as astronomically unlikely false positive.
    expect(seen.size).toBeGreaterThanOrEqual(499)
  })
})

describe('nowIso', () => {
  it('returns an ISO 8601 UTC timestamp', () => {
    const iso = nowIso()
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('is monotonic (or at least non-decreasing) across subsequent calls', () => {
    const a = nowIso()
    const b = nowIso()
    expect(new Date(b).getTime()).toBeGreaterThanOrEqual(new Date(a).getTime())
  })
})
