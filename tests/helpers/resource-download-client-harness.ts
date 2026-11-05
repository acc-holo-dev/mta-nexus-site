import { createHash } from "node:crypto";

/** Shared AbortController factory for resource-download-client concern suites. */
export const controller = () => new AbortController();

/** Hex SHA-256 of a body, matching the X-Content-SHA256 header contract. */
export const sha256 = (body: string | Uint8Array) =>
  createHash("sha256").update(body).digest("hex");

/** Successful archive Response with Content-Length and matching digest headers. */
export const response = (body = "archive", headers: Record<string, string> = {}) =>
  new Response(body, {
    headers: {
      "Content-Length": String(new TextEncoder().encode(body).byteLength),
      "X-Content-SHA256": sha256(body),
      ...headers,
    },
  });
