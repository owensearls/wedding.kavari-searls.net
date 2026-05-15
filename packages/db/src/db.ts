import { Kysely } from 'kysely'
import { D1Dialect } from 'kysely-d1'
import type { Database } from './schema'

export type Db = Kysely<Database>

export function getDb(arg: D1Database | Kysely<Database>): Db {
  // Duck-type: a Kysely instance exposes `selectFrom`; D1Database does not.
  if (arg && typeof (arg as Kysely<Database>).selectFrom === 'function') {
    return arg as Kysely<Database>
  }
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: arg as D1Database }),
  })
}

export function newId(prefix = '') {
  // Workers runtime ships with crypto.randomUUID
  const id = crypto.randomUUID().replace(/-/g, '')
  return prefix ? `${prefix}_${id}` : id
}

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export function newInviteCode(length = 8) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export function nowIso() {
  return new Date().toISOString()
}
