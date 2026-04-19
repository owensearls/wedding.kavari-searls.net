import { afterAll, beforeAll, expect, test } from "vitest";
import { readdirSync } from "node:fs";
import { createServer, isRunnableDevEnvironment, type ViteDevServer } from "vite";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { createRequestListener } from "@remix-run/node-fetch-server";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database as DbSchema } from "../../src/server/lib/schema";

let server: ViteDevServer;
let baseUrl: string;
let sqliteDb: Database.Database;
let localKyselyDb: Kysely<DbSchema>;

async function getEncodeReply(): Promise<(args: unknown[]) => Promise<BodyInit>> {
  // Use the `client.edge` vendor bundle directly: `@vitejs/plugin-rsc/browser`
  // has side-effect imports of virtual modules that only resolve under Vite
  // (not plain Node), and `client.browser` expects `__webpack_require__`. The
  // edge build is plain ESM/CJS and exposes the same `encodeReply`.
  const mod: { encodeReply: (args: unknown[]) => Promise<BodyInit> } =
    await import(
      "@vitejs/plugin-rsc/vendor/react-server-dom/client.edge"
    );
  return mod.encodeReply;
}

function resolveSqlitePath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  const entries = readdirSync(dir);
  const match = entries.find(
    (e) => e.endsWith(".sqlite") && e !== "metadata.sqlite"
  );
  if (!match) throw new Error("no local D1 sqlite file; run pnpm db:migrate:local");
  return `${dir}/${match}`;
}

async function loadRscModule<T = unknown>(id: string): Promise<T> {
  const env = server.environments.rsc;
  if (!isRunnableDevEnvironment(env)) {
    throw new Error("rsc environment is not runnable");
  }
  return (await env.runner.import(id)) as T;
}

beforeAll(async () => {
  sqliteDb = new Database(resolveSqlitePath());
  localKyselyDb = new Kysely<DbSchema>({
    dialect: new SqliteDialect({ database: sqliteDb }),
  });

  // Pick a high random port to avoid clashes with a dev server on 5173.
  const port = 20000 + Math.floor(Math.random() * 20000);
  server = await createServer({
    configFile: "./vite.config.node.ts",
    server: { port, strictPort: false, host: "127.0.0.1" },
    // Avoid auto-opening browser / HMR clients by forcing `appType: custom`.
    appType: "custom",
  });
  await server.listen();
  const addr = server.httpServer!.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  baseUrl = `http://127.0.0.1:${addr.port}`;

  // Wire /@rsc/* to the RSC handler in dev. The plugin is configured with
  // `serverHandler: false`, so no middleware is auto-registered. Pull the
  // handler from the rsc environment's runner so server functions get the
  // RSC transform and carry $$id.
  const entry = await loadRscModule<typeof import("../../src/entry.rsc.ts")>(
    "/src/entry.rsc.ts"
  );
  const rscHandler = entry.createRscHandler(); // no auth for tests

  // IMPORTANT: load runWithEnv via the RSC env runner so we share the same
  // AsyncLocalStorage instance the server functions use. Loading
  // `src/server/context.ts` through Node's default loader would create a
  // second, unrelated ALS and the env wouldn't be visible in getEnv().
  const ctx = await loadRscModule<typeof import("../../src/server/context")>(
    "/src/server/context.ts"
  );
  const runWithEnv = ctx.runWithEnv;

  const listener = createRequestListener(async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/@rsc/")) {
      return new Response("not found", { status: 404 });
    }
    try {
      return await runWithEnv({ DB: localKyselyDb }, () => rscHandler(request));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[test rsc handler error]", e);
      const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
      return new Response(msg, { status: 500 });
    }
  });

  server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
    if (!req.url?.startsWith("/@rsc/")) return next();
    Promise.resolve(listener(req, res)).catch(next);
  });
}, 60_000);

afterAll(async () => {
  await server?.close();
  sqliteDb?.close();
});

function extractActionId(fn: unknown): string {
  if (!fn || typeof fn !== "function") {
    throw new Error("not a function");
  }
  const id = (fn as { $$id?: unknown }).$$id;
  if (typeof id !== "string" || !id.includes("#")) {
    throw new Error(
      `server function missing $$id; got ${String(id)}. fn keys: ${Object.getOwnPropertyNames(
        fn
      ).join(",")}`
    );
  }
  return id;
}

test("public RPC: lookupGuests returns 200 with matches array", async () => {
  const mod = await loadRscModule<typeof import("../../src/server/public/rsvp")>(
    "/src/server/public/rsvp.ts"
  );
  const id = extractActionId(mod.lookupGuests);

  const encodeReply = await getEncodeReply();
  const body = await encodeReply(["kavari"]);
  const res = await fetch(`${baseUrl}/@rsc/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "rsc-action-id": id },
    body: body as BodyInit,
  });
  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`expected 200, got ${res.status}: ${text}`);
  }
  expect(res.status).toBe(200);
  // Response body is an RSC stream; just make sure it's non-empty.
  const bodyText = await res.text();
  expect(bodyText.length).toBeGreaterThan(0);
});

test("unknown action id is rejected with 403", async () => {
  const encodeReply = await getEncodeReply();
  const body = await encodeReply([]);
  // Fabricate an id that is not in either allowlist.
  const fakeId = "deadbeef#nothing";
  const res = await fetch(`${baseUrl}/@rsc/${encodeURIComponent(fakeId)}`, {
    method: "POST",
    headers: { "rsc-action-id": fakeId },
    body: body as BodyInit,
  });
  expect(res.status).toBe(403);
});

test("admin RPC (no auth in Node dev) returns 200", async () => {
  const mod = await loadRscModule<typeof import("../../src/server/admin/events")>(
    "/src/server/admin/events.ts"
  );
  const id = extractActionId(mod.listEvents);

  const encodeReply = await getEncodeReply();
  const body = await encodeReply([]);
  const res = await fetch(`${baseUrl}/@rsc/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "rsc-action-id": id },
    body: body as BodyInit,
  });
  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`expected 200, got ${res.status}: ${text}`);
  }
  expect(res.status).toBe(200);
});
