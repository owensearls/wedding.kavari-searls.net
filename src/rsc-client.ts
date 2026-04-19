import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from "@vitejs/plugin-rsc/browser";

// Single-endpoint RPC. The server authorizes admin vs public by looking up
// the action id in module-derived allowlists, so the client does not need to
// encode that distinction in the URL. This also avoids depending on the id
// format, which is path-based in dev but opaque-hashed in production builds.
export function setupServerCallback(): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args);
    const response = fetch(`/@rsc/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "rsc-action-id": id },
      body,
    });
    return createFromFetch(response);
  });
}
