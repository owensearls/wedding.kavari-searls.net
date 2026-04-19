import { createRscHandler } from "./entry.rsc.ts";
import { runWithEnv } from "./server/context";
import { verifyAccessJwt } from "./server/auth";

// Re-export so the Node production server can reach the un-bundled helpers
// via the built `dist/rsc/index.js` (which inlines virtual RSC modules).
export { createRscHandler, runWithEnv };

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
}

// Loopback hostnames can only be reached in local dev: Cloudflare won't route
// a request whose URL hostname is localhost to a deployed Worker, so this is
// safe to treat as a trusted-dev signal without any config flag.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const handler = createRscHandler(async (request) => {
  // Runs only for action ids in the admin allowlist (see entry.rsc.ts).
  // Verifies the Cloudflare Access JWT injected at the edge.
  if (LOCAL_HOSTNAMES.has(new URL(request.url).hostname)) return null;
  const ok = await verifyAccessJwt(request, {
    aud: globalThis.ACCESS_AUD,
    teamDomain: globalThis.ACCESS_TEAM_DOMAIN,
  });
  return ok ? null : new Response("Unauthorized", { status: 401 });
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return runWithEnv(env, async () => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/@rsc/")) {
        // Access config values live on env, not globals — forward via closure.
        // TODO(task-7): replace this globalThis shim by extending runWithEnv's env object so verifyAccessJwt reads from getEnv() instead of globals.
        (globalThis as any).ACCESS_AUD = env.ACCESS_AUD;
        (globalThis as any).ACCESS_TEAM_DOMAIN = env.ACCESS_TEAM_DOMAIN;
        return handler(request);
      }
      // Serve static assets; if 404, SPA-fallback to the appropriate shell.
      // We disable Wrangler's built-in single-page-application fallback in
      // wrangler.toml so we can route /admin/* sub-paths to admin/index.html
      // instead of the public root index.html.
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;

      const shellPath = url.pathname.startsWith("/admin/") ? "/admin/" : "/";
      const shellUrl = new URL(shellPath, url);
      return env.ASSETS.fetch(new Request(shellUrl, request));
    });
  },
} satisfies ExportedHandler<Env>;
