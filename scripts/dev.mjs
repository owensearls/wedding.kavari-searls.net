// Boots both Vite dev servers and threads the frontend's resolved URL into
// rsvp via VITE_FRONTEND_URL, so admin links work even when Vite falls
// through to a non-default port.
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Vite resolves vite.config.ts, root, and rollupOptions.input relative to
// cwd; matching `pnpm --filter frontend dev` requires chdir into the package.
process.chdir(resolve(repoRoot, 'packages/frontend'))
const frontend = await createServer()
await frontend.listen()
frontend.printUrls()

const frontendUrl = frontend.resolvedUrls?.local[0]?.replace(/\/$/, '')
if (!frontendUrl) {
  await frontend.close()
  throw new Error('frontend started but no local URL was resolved')
}

const rsvp = spawn('pnpm', ['--filter', 'rsvp', 'dev'], {
  stdio: 'inherit',
  cwd: repoRoot,
  env: { ...process.env, VITE_FRONTEND_URL: frontendUrl },
})

let shuttingDown = false
const shutdown = async (code = 0) => {
  if (shuttingDown) return
  shuttingDown = true
  if (!rsvp.killed) rsvp.kill('SIGTERM')
  await frontend.close()
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
rsvp.on('exit', (code) => shutdown(code ?? 0))
