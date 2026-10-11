import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
import { parseDiscoverApiQuery } from "./discover-query";
export const STREAM_TYPES = ["servers", "creators", "organizations"] as const;
const cursorSchema = discussionCursorSchema
  .extend({
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    version: z.literal(1),
    direction: z.enum(["older", "newer"]),
  })
  .strict();
export function parseDiscoveryStreamQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) =>
        !["type", "q", "verified", "language", "region", "gameMode", "cursor"].includes(key) ||
        params.getAll(key).length !== 1,
    )
  )
    return null;
  const type = params.get("type") || "servers";
  if (!(STREAM_TYPES as readonly string[]).includes(type)) return null;
  if (
    ["q", "language", "region", "gameMode"].some((key) =>
      Array.from(params.get(key) ?? "").some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      ),
    )
  )
    return null;
  if (type !== "servers" && ["language", "region", "gameMode"].some((key) => params.has(key)))
    return null;
  const base = new URLSearchParams(params);
  base.delete("cursor");
  const state = parseDiscoverApiQuery(base);
  if (!state) return null;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (params.has("cursor")) {
    const raw = params.get("cursor") ?? "";
    if (raw.length > 512) return null;
    try {
      const parsed = cursorSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      cursor = parsed.data;
    } catch {
      return null;
    }
  }
  return { ...state, type: type as (typeof STREAM_TYPES)[number], cursor };
}
export type DiscoveryStreamQuery = NonNullable<ReturnType<typeof parseDiscoveryStreamQuery>>;
export function discoveryStreamHref(
  input: Pick<
    DiscoveryStreamQuery,
    "type" | "query" | "verified" | "language" | "region" | "gameMode"
  >,
  cursor?: string | null,
  api = false,
) {
  const params = new URLSearchParams({ type: input.type });
  if (input.query) params.set("q", input.query);
  if (input.verified) params.set("verified", "1");
  if (input.type === "servers")
    for (const key of ["language", "region", "gameMode"] as const)
      if (input[key]) params.set(key, input[key]);
  if (cursor) params.set("cursor", cursor);
  return `${api ? "/api" : ""}/discover/stream?${params}`;
}
