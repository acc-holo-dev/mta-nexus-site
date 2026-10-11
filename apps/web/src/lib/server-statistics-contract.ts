import { z } from "zod";
import type { ServerHistoryWindow } from "./server-history-window";

const querySchema = z
  .object({
    window: z.enum(["24h", "7d", "30d"]).default("24h"),
    end: z.iso.datetime({ precision: 3 }).optional(),
    before: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,128}$/u)
      .optional(),
    format: z.enum(["buckets", "observations"]).optional(),
  })
  .strict()
  .refine((value) => !value.before || !!value.end);

export function parseServerStatisticsQuery(params: URLSearchParams, exporting = false) {
  const input: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in input || (!exporting && key === "format")) return null;
    input[key] = value;
  }
  const parsed = querySchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function serverStatisticsHref(
  path: string,
  state: {
    window: ServerHistoryWindow;
    end?: string;
    before?: string | null;
    format?: "buckets" | "observations";
  },
) {
  const params = new URLSearchParams({ window: state.window });
  if (state.end) params.set("end", state.end);
  if (state.before) params.set("before", state.before);
  if (state.format) params.set("format", state.format);
  return `${path}?${params}`;
}

export type ServerStatisticsQuery = NonNullable<ReturnType<typeof parseServerStatisticsQuery>>;
