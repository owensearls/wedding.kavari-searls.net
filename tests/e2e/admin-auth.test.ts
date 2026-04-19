import { afterAll, beforeAll, expect, test } from "vitest";
import { createServer, isRunnableDevEnvironment, type ViteDevServer } from "vite";

let server: ViteDevServer;
let createRscHandler: typeof import("../../src/entry.rsc").createRscHandler;

async function loadRscModule<T = unknown>(id: string): Promise<T> {
  const env = server.environments.rsc;
  if (!isRunnableDevEnvironment(env)) {
    throw new Error("rsc environment is not runnable");
  }
  return (await env.runner.import(id)) as T;
}

beforeAll(async () => {
  // Use a high random port to avoid clashes with a dev server.
  const port = 20000 + Math.floor(Math.random() * 20000);
  server = await createServer({
    configFile: "./vite.config.node.ts",
    server: { port, strictPort: false, host: "127.0.0.1" },
    appType: "custom",
  });
  await server.listen();

  // Load entry.rsc via the RSC env runner because
  // @vitejs/plugin-rsc/rsc imports virtual modules that only resolve
  // under Vite, not plain Node's ESM loader.
  const entry = await loadRscModule<typeof import("../../src/entry.rsc")>(
    "/src/entry.rsc.tsx",
  );
  createRscHandler = entry.createRscHandler;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

test("admin path returns 401 when authorize callback denies", async () => {
  const handler = createRscHandler(async () => new Response("Unauthorized", { status: 401 }));
  const res = await handler(
    new Request("http://x/@rsc/admin/src/server/admin/events.ts%23listEvents", { method: "POST" }),
  );
  expect(res.status).toBe(401);
});

test("public path ignores authorize callback", async () => {
  const handler = createRscHandler(async () => new Response("Unauthorized", { status: 401 }));
  // On the public prefix the authorize callback is skipped and control flows
  // past the auth branch. The request has no body, so `decodeReply` will
  // either return a non-401 Response or throw — both outcomes prove the
  // callback was not consulted. Capture either and assert not 401.
  let status: number | null = null;
  try {
    const res = await handler(
      new Request("http://x/@rsc/public/src/server/public/rsvp.ts%23lookupGuests", {
        method: "POST",
      }),
    );
    status = res.status;
  } catch {
    // decodeReply rejected on an empty body — not an auth failure.
    status = null;
  }
  expect(status).not.toBe(401);
});
