import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { adminImportSchema } from '../../schema'
import { findUnknownEventSlugs } from './importHelpers'

function parseCsv(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })
  const schemaParsed = adminImportSchema.safeParse({ rows: parsed.data })
  if (!schemaParsed.success) throw schemaParsed.error
  return schemaParsed.data.rows
}

describe('findUnknownEventSlugs', () => {
  it('returns slugs that are not in the known set', () => {
    const rows = parseCsv(`groupLabel,firstName,events
,Aa,"ceremony,welcome-dinner"
,Bb,"ceremony,brunch"`)
    expect(findUnknownEventSlugs(rows, ['ceremony', 'welcome-dinner'])).toEqual(
      ['brunch']
    )
  })

  it('returns an empty array when every slug is known', () => {
    const rows = parseCsv(`groupLabel,firstName,events
,Aa,"ceremony,reception"`)
    expect(findUnknownEventSlugs(rows, ['ceremony', 'reception'])).toEqual([])
  })

  it('ignores rows with no events column value', () => {
    const rows = parseCsv(`groupLabel,firstName,events
,Aa,`)
    expect(findUnknownEventSlugs(rows, ['ceremony'])).toEqual([])
  })
})
