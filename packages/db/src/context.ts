import { AsyncLocalStorage } from 'node:async_hooks'
import type { Database } from './schema'
import type { Kysely } from 'kysely'

export type ServerEnv =
  | { DB: D1Database } // Worker env
  | { DB: Kysely<Database> } // Node env

const envStorage = new AsyncLocalStorage<ServerEnv>()

export function runWithEnv<T>(env: ServerEnv, fn: () => T): T {
  return envStorage.run(env, fn)
}

export function getEnv(): ServerEnv {
  const env = envStorage.getStore()
  if (!env) throw new Error('Env not available outside request context')
  return env
}
