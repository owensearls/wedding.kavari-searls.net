import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { createRequestListener } from "@remix-run/node-fetch-server";
import { createRscHandler } from "./entry.rsc";
import { runWithEnv } from "./server/context";

const CLIENT_DIR = resolve("dist/client");
const PORT = Number(process.env.PORT ?? 3000);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const rscHandler = createRscHandler(); // no auth: Node target is dev/on-prem behind firewall

async function serveStatic(pathname: string): Promise<Response | null> {
  const safe = pathname.replace(/\?.*$/, "").replace(/^\/+/, "");
  const filePath = join(CLIENT_DIR, safe || "index.html");
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return null;
    const buf = await readFile(filePath);
    return new Response(buf, {
      headers: { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" },
    });
  } catch {
    return null;
  }
}

const listener = createRequestListener(async (request) => {
  const env = (globalThis as any).__NODE_ENV__ as { DB: unknown };
  return runWithEnv(env as any, async () => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/@rsc/")) return rscHandler(request);
    const file = await serveStatic(url.pathname);
    if (file) return file;
    const html = await readFile(join(CLIENT_DIR, "index.html"));
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  });
});

createServer(listener).listen(PORT, () => {
  console.log(`Serving on http://localhost:${PORT}`);
});
