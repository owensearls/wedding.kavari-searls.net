import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from "@vitejs/plugin-rsc/browser";

export function setupServerCallback(): void {
  setServerCallback(async (id, args) => {
    const prefix = id.includes("src/server/admin/") ? "admin" : "public";
    const body = await encodeReply(args);
    const response = fetch(`/@rsc/${prefix}/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "rsc-action-id": id },
      body,
    });
    return createFromFetch(response);
  });
}
