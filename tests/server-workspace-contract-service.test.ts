import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ preview: vi.fn(), save: vi.fn(), history: vi.fn() }));
vi.mock("@nexus/db", () => ({
  serverRepository: { previewVisibilityBatch: state.preview, applyVisibilityBatch: state.save },
  organizationRepository: {},
  auditRepository: { managedServerHistory: state.history },
}));

import type { User } from "@nexus/domain";
import {
  confirmsServerVisibilityCommand,
  confirmsServerVisibilityPreview,
  parseServerWorkspaceHistoryQuery,
  serverVisibilityCommand,
  serverVisibilityInput,
  serverWorkspaceHistoryHref,
} from "../apps/web/src/lib/server-workspace-contract";
import {
  serverWorkspaceCopy,
  serverWorkspaceError,
} from "../apps/web/src/lib/server-workspace-copy";
import { serverService } from "../apps/web/src/lib/services/server-service";
import { serverWorkspaceHistoryService } from "../apps/web/src/lib/services/server-workspace-history-service";

const time = "2026-10-12T00:00:00.123456Z",
  next = "2026-10-12T00:00:00.124456Z",
  token = "a".repeat(64),
  actor = { id: "actor", role: "user" } as User;
const input = { serverIds: ["a", "b"], visibility: "private" as const };
const preview = {
  visibility: "private" as const,
  previewRevision: token,
  items: [
    {
      id: "a",
      name: "Server",
      status: "active" as const,
      organization: false,
      before: "public" as const,
      after: "private" as const,
      changed: true,
      revision: time,
    },
    {
      id: "b",
      name: "Team",
      status: "maintenance" as const,
      organization: true,
      before: "private" as const,
      after: "private" as const,
      changed: false,
      revision: time,
    },
  ],
};
const ack = {
  visibility: "private",
  previewRevision: token,
  items: [
    { id: "a", visibility: "private", changed: true, revision: next },
    { id: "b", visibility: "private", changed: false, revision: time },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  state.preview.mockResolvedValue(preview);
  state.save.mockResolvedValue(ack);
  state.history.mockResolvedValue({
    server: { id: "a", name: "Server" },
    until: time,
    period: "all",
    action: "all",
    events: [
      {
        id: "audit",
        action: "server.updated",
        actorId: "secret-editor-id",
        actorType: "user",
        actorUsername: "editor",
        actorDisplayName: "Editor",
        fields: ["visibility"],
        createdAt: time,
        fromVisibility: "public",
        toVisibility: "private",
        details: { ip: "private detail" },
      },
    ],
    nextCursor: { context: token, until: time, id: "audit" },
  });
});
it.each([
  { serverIds: [] },
  { serverIds: ["a", "a"] },
  { serverIds: Array.from({ length: 21 }, (_, i) => `s${i}`) },
  { serverIds: ["../id"] },
  { visibility: "suspended" },
  { ownerId: "foreign" },
])("rejects invalid commands before repository calls (%j)", async (value) => {
  expect(serverVisibilityInput.safeParse({ ...input, ...value }).success).toBe(false);
  await expect(
    serverService.previewVisibility(actor, { ...input, ...value }),
  ).rejects.toMatchObject({ code: "SERVER_BATCH_INVALID" });
  expect(state.preview).not.toHaveBeenCalled();
});
it("requires a reviewed token and generates unique mandatory audits within the bounded service command", async () => {
  expect(serverVisibilityCommand.safeParse(input).success).toBe(false);
  await expect(serverService.saveVisibility(actor, input)).rejects.toMatchObject({
    code: "SERVER_BATCH_INVALID",
  });
  await serverService.saveVisibility(actor, { ...input, previewRevision: token });
  expect(state.save).toHaveBeenCalledOnce();
  const args = state.save.mock.calls[0];
  expect(args[0]).toBe("actor");
  expect(args[1]).toEqual({ ...input, previewRevision: token });
  expect(new Set(args[2]).size).toBe(2);
});
it("accepts only exact preview identities, current states and server-preserved no-op flags", async () => {
  expect(confirmsServerVisibilityPreview(preview, input)).toEqual(preview);
  expect(confirmsServerVisibilityPreview({ ...preview, ownerId: "private" }, input)).toBeNull();
  for (const change of [
    { id: "foreign" },
    { after: "public" },
    { changed: false },
    { revision: "2026-10-12T00:00:00.123Z" },
  ])
    expect(
      confirmsServerVisibilityPreview(
        { ...preview, items: [{ ...preview.items[0], ...change }, preview.items[1]] },
        input,
      ),
    ).toBeNull();
  expect(
    confirmsServerVisibilityPreview(
      { ...preview, items: [preview.items[0], preview.items[0]] },
      input,
    ),
  ).toBeNull();
});
it("requires exact saved visibility, unique selected IDs and appropriate microsecond revisions", () => {
  expect(confirmsServerVisibilityCommand(ack, preview)).toBe(true);
  for (const change of [
    { id: "foreign" },
    { visibility: "public" },
    { revision: time },
    { changed: false },
  ])
    expect(
      confirmsServerVisibilityCommand(
        { ...ack, items: [{ ...ack.items[0], ...change }, ack.items[1]] },
        preview,
      ),
    ).toBe(false);
  expect(
    confirmsServerVisibilityCommand(
      { ...ack, items: [ack.items[0], { ...ack.items[1], revision: next }] },
      preview,
    ),
  ).toBe(false);
  expect(confirmsServerVisibilityCommand({ ...ack, ownerId: "secret" }, preview)).toBe(false);
});
it("fails closed rather than returning unexpected private repository fields", async () => {
  state.preview.mockResolvedValue({ ...preview, grants: { secret: "member" } });
  await expect(serverService.previewVisibility(actor, input)).rejects.toThrow();
  state.save.mockResolvedValue({ ...ack, ownerId: "secret" });
  await expect(
    serverService.saveVisibility(actor, { ...input, previewRevision: token }),
  ).rejects.toThrow();
});
it.each([
  "period=bad",
  "action=payment",
  "limit=100",
  "before=a&before=b",
  "before=a&period=7",
  "cursor=../foreign",
  "until=invalid",
  "until=2026-10-12T00:00:00.123456Z&until=2026-10-12T00:00:00.123456Z",
])("rejects invalid or repeated history query %s", (query) => {
  expect(parseServerWorkspaceHistoryQuery(new URLSearchParams(query))).toBeNull();
});
it("validates a canonical cursor without losing the cutoff's microseconds", () => {
  const cursor = Buffer.from(JSON.stringify({ context: token, until: time, id: "audit" })).toString(
    "base64url",
  );
  expect(
    parseServerWorkspaceHistoryQuery(
      new URLSearchParams({ cursor, period: "30", action: "visibility", until: time }),
    ),
  ).toEqual({
    cursor: { context: token, until: time, id: "audit" },
    period: "30",
    action: "visibility",
    legacyCursor: undefined,
    until: time,
  });
  expect(
    parseServerWorkspaceHistoryQuery(
      new URLSearchParams({
        cursor: Buffer.from(
          JSON.stringify({ context: token, until: time, id: "audit", private: "extra" }),
        ).toString("base64url"),
      }),
    ),
  ).toBeNull();
  expect(
    serverWorkspaceHistoryHref("s/id", { period: "30", action: "visibility" }, cursor),
  ).toContain("/workspace/servers/s%2Fid/activity?period=30&action=visibility&cursor=");
});
it("projects recorded visibility transitions and public identities without internal actor IDs or details", async () => {
  const result = await serverWorkspaceHistoryService.page("actor", "a", {
    action: "all",
    period: "all",
    cursor: undefined,
    legacyCursor: undefined,
    until: undefined,
  });
  expect(result.events[0]).toEqual({
    id: "audit",
    action: "server.updated",
    actor: "team",
    identity: { username: "editor", name: "Editor" },
    fields: ["visibility"],
    createdAt: time,
    transition: { before: "public", after: "private" },
  });
  expect(JSON.stringify(result)).not.toMatch(/secret-editor-id|private detail|actorId|details/u);
  expect(JSON.parse(Buffer.from(result.nextCursor ?? "", "base64url").toString())).toEqual({
    context: token,
    until: time,
    id: "audit",
  });
});
it.each(["admin", "system", "user"])(
  "preserves actor labels and never derives unrecorded transition values (%s)",
  async (actorType) => {
    const base = await state.history();
    state.history.mockResolvedValue({
      ...base,
      events: [
        {
          ...base.events[0],
          actorType,
          actorId: "actor",
          fromVisibility: null,
          toVisibility: null,
        },
      ],
    });
    const result = await serverWorkspaceHistoryService.page("actor", "a", {
      action: "all",
      period: "all",
      cursor: undefined,
      legacyCursor: undefined,
      until: undefined,
    });
    expect(result.events[0].actor).toBe(
      actorType === "admin" ? "moderation" : actorType === "system" ? "system" : "you",
    );
    expect(result.events[0].transition).toBeNull();
    expect(result.events[0]).not.toHaveProperty("actorId");
  },
);
it.each(["en", "ru"] as const)(
  "keeps localized workspace copy and domain errors complete in %s",
  (locale) => {
    expect(Object.keys(serverWorkspaceCopy(locale)).sort()).toEqual(
      Object.keys(serverWorkspaceCopy("en")).sort(),
    );
    expect(serverWorkspaceError(locale, "SERVER_BATCH_CHANGED")).toBe(
      serverWorkspaceCopy(locale).changed,
    );
    expect(serverWorkspaceError(locale, "FORBIDDEN")).toBe(serverWorkspaceCopy(locale).forbidden);
    expect(serverWorkspaceError(locale, "INVALID_CURSOR")).toBe(
      serverWorkspaceCopy(locale).historyInvalid,
    );
  },
);
