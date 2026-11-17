import { SERVER_ACTIVITY_ACTIONS, SERVER_ACTIVITY_FIELDS } from "@nexus/domain";
import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
const revision = z.iso.datetime({ precision: 6 });
const visibility = z.enum(["public", "unlisted", "private"]);
const text = (limit: number) =>
  z
    .string()
    .max(limit * 2)
    .refine((value) => Array.from(value).length <= limit);
export const serverVisibilityInput = z
  .object({
    serverIds: z
      .array(id)
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length),
    visibility,
  })
  .strict();
export const serverVisibilityCommand = serverVisibilityInput
  .extend({ previewRevision: z.string().regex(/^[a-f0-9]{64}$/u) })
  .strict();
export const serverVisibilityPreviewSchema = z
  .object({
    visibility,
    previewRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    items: z
      .array(
        z
          .object({
            id,
            name: text(200),
            status: z.enum(["active", "inactive", "maintenance", "suspended"]),
            organization: z.boolean(),
            before: visibility,
            after: visibility,
            revision,
            changed: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type ServerVisibilityPreview = z.infer<typeof serverVisibilityPreviewSchema>;
export function confirmsServerVisibilityPreview(
  value: unknown,
  input: z.infer<typeof serverVisibilityInput>,
) {
  const parsed = serverVisibilityPreviewSchema.safeParse(value);
  if (!parsed.success) return null;
  const data = parsed.data;
  return data.visibility === input.visibility &&
    data.items.length === input.serverIds.length &&
    new Set(data.items.map((item) => item.id)).size === data.items.length &&
    data.items.every(
      (item) =>
        input.serverIds.includes(item.id) &&
        item.after === input.visibility &&
        item.changed === (item.before !== item.after),
    )
    ? data
    : null;
}
export const serverVisibilityResultSchema = z
  .object({
    visibility,
    previewRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    items: z
      .array(z.object({ id, visibility, revision, changed: z.boolean() }).strict())
      .min(1)
      .max(20),
  })
  .strict();
export function confirmsServerVisibilityCommand(value: unknown, preview: ServerVisibilityPreview) {
  const parsed = serverVisibilityResultSchema.safeParse(value);
  return (
    parsed.success &&
    parsed.data.visibility === preview.visibility &&
    parsed.data.previewRevision === preview.previewRevision &&
    parsed.data.items.length === preview.items.length &&
    new Set(parsed.data.items.map((item) => item.id)).size === parsed.data.items.length &&
    parsed.data.items.every((item) => {
      const expected = preview.items.find((row) => row.id === item.id);
      return (
        expected &&
        item.visibility === expected.after &&
        item.changed === expected.changed &&
        (item.changed ? item.revision > expected.revision : item.revision === expected.revision)
      );
    })
  );
}
const historyCursor = z
  .object({ context: z.string().regex(/^[a-f0-9]{64}$/u), until: revision, id })
  .strict();
const serverHistoryFilterSchema = z
  .object({
    period: z.enum(["all", "7", "30", "90", "365"]).default("all"),
    action: z.enum(["all", "listing", "visibility", "control", "verification"]).default("all"),
    cursor: z
      .string()
      .min(1)
      .max(2048)
      .regex(/^[A-Za-z0-9_-]+$/u)
      .optional(),
    before: id.optional(),
    until: revision.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !(value.cursor && value.before) &&
      (!value.before || (value.period === "all" && value.action === "all")),
  );
export function parseServerWorkspaceHistoryQuery(params: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in raw) return null;
    raw[key] = value;
  }
  const result = serverHistoryFilterSchema.safeParse(raw);
  if (!result.success) return null;
  let cursor: z.infer<typeof historyCursor> | undefined;
  if (result.data.cursor) {
    try {
      const value = Buffer.from(result.data.cursor, "base64url").toString("utf8");
      const parsed = historyCursor.safeParse(JSON.parse(value));
      if (!parsed.success || Buffer.from(value).toString("base64url") !== result.data.cursor)
        return null;
      cursor = parsed.data;
    } catch {
      return null;
    }
  }
  return {
    period: result.data.period,
    action: result.data.action,
    cursor,
    legacyCursor: result.data.before,
    until: result.data.until,
  };
}
export const serverWorkspaceHistorySchema = z
  .object({
    server: z.object({ id, name: text(200) }).strict(),
    until: revision,
    period: serverHistoryFilterSchema.shape.period,
    action: serverHistoryFilterSchema.shape.action,
    events: z
      .array(
        z
          .object({
            id,
            action: z.enum(SERVER_ACTIVITY_ACTIONS),
            actor: z.enum(["you", "team", "system", "moderation"]),
            identity: z
              .object({ username: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/u), name: text(128) })
              .strict()
              .nullable(),
            fields: z.array(z.enum(SERVER_ACTIVITY_FIELDS)).max(16),
            createdAt: z.iso.datetime(),
            transition: z.object({ before: visibility, after: visibility }).strict().nullable(),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z.string().max(2048).nullable(),
  })
  .strict();
export function serverWorkspaceHistoryHref(
  serverId: string,
  filters: { period?: string; action?: string },
  cursor?: string | null,
) {
  const params = new URLSearchParams();
  if (filters.period && filters.period !== "all") params.set("period", filters.period);
  if (filters.action && filters.action !== "all") params.set("action", filters.action);
  if (cursor) params.set("cursor", cursor);
  const base = `/workspace/servers/${encodeURIComponent(serverId)}/activity`;
  return `${base}${params.size ? `?${params}` : ""}`;
}
