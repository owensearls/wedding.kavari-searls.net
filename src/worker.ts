import { createRscHandler } from "./entry.rsc";
import { runWithEnv } from "./server/context";
import { verifyAccessJwt } from "./server/auth";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
}

const handler = createRscHandler(async (request) => {
  // This callback only runs for /@rsc/admin/*. Verify Access JWT.
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
        (globalThis as any).ACCESS_AUD = env.ACCESS_AUD;
        (globalThis as any).ACCESS_TEAM_DOMAIN = env.ACCESS_TEAM_DOMAIN;
        return handler(request);
      }
      return env.ASSETS.fetch(request);
    });
  },
} satisfies ExportedHandler<Env>;
