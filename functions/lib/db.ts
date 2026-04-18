import { Kysely } from 'kysely'
import { D1Dialect } from 'kysely-d1'
import type { Database } from './schema'

export interface Env {
  DB: D1Database
}

export function getDb(d1: D1Database) {
  return new Kysely<Database>({
    dialect: new D1Dialect({ database: d1 }),
  })
}

export type Db = ReturnType<typeof getDb>

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
