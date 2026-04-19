import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from "@vitejs/plugin-rsc/rsc";

// Auto-discover every server-action module with Vite's `import.meta.glob`.
// Two jobs here:
//
// 1. Plugin-rsc only registers modules it sees via graph walk. Without these
//    eager imports, `loadServerAction(id)` throws because the built RSC
//    bundle's server-references manifest is empty. (The client bundle does
//    import these, but its graph doesn't feed back into the worker bundle.)
//
// 2. At module-load time each export becomes a server reference with a
//    `$$id` property. We collect those ids into admin/public allowlists so
//    the handler can validate incoming action ids. In production builds
//    plugin-rsc hashes ids (`hashString(relativeId)`), so a substring check
//    like `id.includes("src/server/admin/")` does not work. Exact-set
//    membership works in both dev (source-path ids) and prod (hashed ids).
//
// Using a glob rather than a hand-maintained list means adding a new module
// under ./server/admin or ./server/public is picked up automatically.
const adminModules = import.meta.glob<Record<string, unknown>>(
  "./server/admin/*.ts",
  { eager: true }
);
const publicModules = import.meta.glob<Record<string, unknown>>(
  "./server/public/*.ts",
  { eager: true }
);

export type Authorize = (request: Request) => Promise<Response | null>;

function collectActionIds(
  modules: Record<string, unknown>[]
): Set<string> {
  const ids = new Set<string>();
  for (const mod of modules) {
    for (const key of Object.keys(mod)) {
      const value = (mod as Record<string, unknown>)[key];
      if (typeof value !== "function") continue;
      const $$id = (value as { $$id?: unknown }).$$id;
      if (typeof $$id === "string") ids.add($$id);
    }
  }
  return ids;
}

const adminActionIds = collectActionIds(Object.values(adminModules));
const publicActionIds = collectActionIds(Object.values(publicModules));

export function createRscHandler(authorize: Authorize = async () => null) {
  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/@rsc/")) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const actionId = decodeURIComponent(
      url.pathname.slice("/@rsc/".length)
    );

    const isAdmin = adminActionIds.has(actionId);
    const isPublic = publicActionIds.has(actionId);
    if (!isAdmin && !isPublic) {
      return new Response("Forbidden", { status: 403 });
    }

    if (isAdmin) {
      const denied = await authorize(request);
      if (denied) return denied;
    }

    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("multipart/form-data")
      ? await request.formData()
      : await request.text();

    const args = await decodeReply(body);
    const fn = await loadServerAction(actionId);
    const result = await fn(...args);

    const stream = renderToReadableStream(result);
    return new Response(stream, {
      headers: { "content-type": "text/x-component" },
    });
  };
}
