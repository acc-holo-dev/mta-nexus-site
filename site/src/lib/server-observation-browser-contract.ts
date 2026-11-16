import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
import { parseServerStatisticsQuery } from "./server-statistics-contract";
const cursorSchema = discussionCursorSchema
  .extend({
    createdAt: discussionCursorSchema.shape.createdAt.refine((value) => /\.\d{6}Z$/u.test(value)),
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    direction: z.enum(["older", "newer"]),
    version: z.literal(1),
  })
  .strict();
const filtersSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    players: z.enum(["all", "known", "unknown", "zero"]).default("all"),
    password: z.enum(["all", "yes", "no", "unknown"]).default("all"),
    responding: z.enum(["all", "yes", "no", "unknown"]).default("all"),
  })
  .strict();
export function parseServerObservationBrowserQuery(params: URLSearchParams) {
  const period = new URLSearchParams(),
    filters: Record<string, string> = {};
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1) return null;
    if (["window", "end", "endUtc"].includes(key)) period.set(key, value);
    else if (["q", "players", "password", "responding"].includes(key)) filters[key] = value;
    else if (key !== "cursor") return null;
  }
  const bounds = parseServerStatisticsQuery(period),
    parsed = filtersSchema.safeParse(filters);
  const raw = params.get("q") ?? "";
  if (
    !bounds ||
    !parsed.success ||
    raw.length > 100 ||
    Array.from(raw).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    return null;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (params.has("cursor")) {
    const value = params.get("cursor") ?? "";
    if (!bounds.end || value.length > 512) return null;
    try {
      const point = cursorSchema.safeParse(JSON.parse(value));
      if (!point.success) return null;
      cursor = point.data;
    } catch {
      return null;
    }
  }
  return {
    window: bounds.window,
    end: bounds.end,
    query: parsed.data.q,
    players: parsed.data.players,
    password: parsed.data.password,
    responding: parsed.data.responding,
    cursor,
  };
}
export type ServerObservationBrowserQuery = NonNullable<
  ReturnType<typeof parseServerObservationBrowserQuery>
>;
export function serverObservationBrowserHref(
  path: string,
  input: Omit<ServerObservationBrowserQuery, "cursor">,
  cursor?: string | null,
) {
  const params = new URLSearchParams({ window: input.window });
  if (input.end) params.set("end", input.end);
  if (input.query) params.set("q", input.query);
  for (const key of ["players", "password", "responding"] as const)
    if (input[key] !== "all") params.set(key, input[key]);
  if (cursor) params.set("cursor", cursor);
  return `${path}?${params}`;
}
