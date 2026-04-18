import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from "@vitejs/plugin-rsc/rsc";

export type Authorize = (request: Request) => Promise<Response | null>;

export function createRscHandler(authorize: Authorize = async () => null) {
  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const adminMatch = url.pathname.startsWith("/@rsc/admin/");
    const publicMatch = url.pathname.startsWith("/@rsc/public/");
    if (!adminMatch && !publicMatch) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (adminMatch) {
      const denied = await authorize(request);
      if (denied) return denied;
    }

    const prefix = adminMatch ? "/@rsc/admin/" : "/@rsc/public/";
    const actionId = decodeURIComponent(url.pathname.slice(prefix.length));

    const expectedDir = adminMatch ? "src/server/admin/" : "src/server/public/";
    if (!actionId.includes(expectedDir)) {
      return new Response("Forbidden", { status: 403 });
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
