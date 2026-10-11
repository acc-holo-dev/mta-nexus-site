import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  servers: vi.fn(),
  creators: vi.fn(),
  organizations: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  command: vi.fn(),
  allowed: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  publicDirectoryRepository: {
    pageServers: mocks.servers,
    pageCreators: mocks.creators,
    pageOrganizations: mocks.organizations,
  },
  communityModerationWorkspaceRepository: { page: mocks.page, detail: mocks.detail },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({ productService: {} }));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: { moderateContent: mocks.command },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {},
  indexMtaObservations: vi.fn(),
  matchesMtaEndpoint: vi.fn(),
}));
vi.mock("@nexus/security", () => ({ can: mocks.allowed }));
import { discoveryService as discovery } from "../apps/web/src/lib/services/discovery-service";
import { communityModerationService as moderation } from "../apps/web/src/lib/services/community-moderation-service";
import {
  parseDiscoveryStreamQuery,
  discoveryStreamHref,
} from "../apps/web/src/lib/discovery-stream-contract";
import {
  parseModerationQuery,
  parseModerationDetailQuery,
  moderationCommandSchema,
  moderationPageSchema,
  moderationDetailSchema,
  moderationHref,
  confirmsModerationCommand,
} from "../apps/web/src/lib/community-moderation-contract";
import { moderationCopy } from "../apps/web/src/lib/community-moderation-copy";
import { discoveryStreamCopy } from "../apps/web/src/lib/discovery-stream-copy";
const time = "2026-10-11T00:00:00.123456Z",
  date = new Date(time),
  actor = { id: "actor", role: "moderator" } as User;
const row = {
  id: "item",
  slug: "post",
  title: "Post",
  type: "post",
  status: "draft",
  excerpt: "Preview",
  updatedAt: date,
  createdAt: date,
  username: "writer",
  name: "Writer",
  avatar: "javascript:bad",
  cursorTime: time,
  email: "PRIVATE",
  productId: "PRIVATE",
};
const result = {
  context: "a".repeat(64),
  hasMore: true,
  nextCursor: { createdAt: time, id: "last" },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allowed.mockReturnValue(true);
  for (const mock of [mocks.servers, mocks.creators, mocks.organizations])
    mock.mockResolvedValue({
      items: [],
      page: 1,
      hasMore: true,
      nextCursor: { createdAt: time, id: "last" },
      previousCursor: null,
    });
  mocks.page.mockResolvedValue({ ...result, items: [row] });
  mocks.detail.mockResolvedValue({
    ...result,
    item: {
      ...row,
      body: "Full text",
      truncated: false,
      tags: ["Lua"],
      organizationName: "Team",
      organizationSlug: "team",
      serverName: null,
      serverSlug: null,
      ownerId: "PRIVATE",
    },
    history: [
      {
        id: "event",
        action: "content.published",
        createdAt: date,
        from: "legacy",
        to: "published",
        notes: "Recorded reason",
        ipAddress: "PRIVATE",
        actorId: "PRIVATE",
      },
    ],
  });
  mocks.command.mockResolvedValue({
    id: "item",
    status: "published",
    updatedAt: new Date("2026-10-11T00:00:01Z"),
    body: "PRIVATE",
  });
});
it.each([
  "?type=resources",
  "?type=content",
  "?page=2",
  "?sort=name",
  "?type=creators&language=ru",
  "?q=%0A",
  "?q=a&q=b",
  "?cursor=bad",
  "?ownerId=private",
])("rejects incompatible/injected stream filters %s", (params) =>
  expect(parseDiscoveryStreamQuery(new URLSearchParams(params))).toBeNull(),
);
it("keeps filters in stream continuations and rejects reuse in another entity family before DB", async () => {
  const input = parseDiscoveryStreamQuery(
    new URLSearchParams("type=servers&q=Lua&language=ru&verified=1"),
  );
  if (!input) throw Error("Expected stream filters");
  const page = await discovery.stream(input);
  expect(mocks.servers).toHaveBeenCalledWith(
    expect.objectContaining({ keyset: true, query: "Lua", language: "ru" }),
  );
  const next = parseDiscoveryStreamQuery(
    new URLSearchParams(
      new URL(discoveryStreamHref(input, page.nextCursor), "https://nexus.test").search,
    ),
  );
  expect(next?.cursor?.createdAt).toBe(time);
  if (!next) throw Error("Expected continuation");
  vi.clearAllMocks();
  await expect(discovery.stream({ ...next, type: "organizations" })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  expect(mocks.organizations).not.toHaveBeenCalled();
  await expect(discovery.stream({ ...next, verified: false })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  expect(mocks.servers).not.toHaveBeenCalled();
});
it.each(["creators", "organizations"] as const)(
  "reuses existing %s directory selection and public-media sanitation",
  async (type) => {
    const mock = mocks[type];
    mock.mockResolvedValue({
      items: [{ id: "public", avatarUrl: "javascript:bad", logoUrl: "javascript:bad" }],
      page: 1,
      hasMore: false,
      nextCursor: null,
      previousCursor: null,
    });
    const input = parseDiscoveryStreamQuery(new URLSearchParams({ type }));
    if (!input) throw Error("Expected filters");
    const page = await discovery.stream(input);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject(
      type === "creators" ? { avatarUrl: null } : { logoUrl: null },
    );
  },
);
it.each([
  "?status=pending",
  "?type=resource",
  "?q=%00",
  "?status=draft&status=all",
  "?author=..",
  "?actorId=other",
  "?cursor=bad",
  "?page=2",
])("rejects malformed/private moderation filters %s", (params) =>
  expect(parseModerationQuery(new URLSearchParams(params))).toBeNull(),
);
it("keeps exact-author/status/type/search filters in queue links and separates detail continuation", () => {
  const filters = parseModerationQuery(
    new URLSearchParams("q=+Lua+&status=all&author=writer&type=post"),
  );
  if (!filters) throw Error("Expected filters");
  expect(filters).toMatchObject({
    query: "Lua",
    status: undefined,
    author: "writer",
    type: "post",
  });
  expect(moderationHref(filters, "a&b")).toContain("cursor=a%26b");
  expect(parseModerationDetailQuery(new URLSearchParams("q=private"))).toBeNull();
});
it("requires current-session staff privilege before any workspace read or command", async () => {
  mocks.allowed.mockReturnValue(false);
  await expect(moderation.page(actor, { query: "" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(moderation.detail(actor, "item")).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.detail).not.toHaveBeenCalled();
});
it("whitelists queue/detail/history DTOs, validates legacy states and retains exact cursor time", async () => {
  const page = await moderation.page(actor, { query: "" }),
    detail = await moderation.detail(actor, "item");
  expect(moderationPageSchema.safeParse(page).success).toBe(true);
  expect(moderationDetailSchema.safeParse(detail).success).toBe(true);
  expect(detail.history[0].from).toBeNull();
  expect(detail.item.author.avatar).toBeNull();
  expect(JSON.stringify({ page, detail })).not.toContain("PRIVATE");
  expect(
    parseModerationQuery(new URLSearchParams({ cursor: page.nextCursor ?? "" }))?.cursor?.createdAt,
  ).toBe(time);
});
it("routes decisions through existing content moderation with observed revision and locked publication scope", async () => {
  const command = {
    action: "publish" as const,
    notes: "Reviewed",
    expectedUpdatedAt: date.toISOString(),
  };
  const saved = await moderation.command(actor, "item", command);
  expect(mocks.command).toHaveBeenCalledWith("item", "publish", actor, "Reviewed", date, true);
  expect(saved).toEqual({
    id: "item",
    action: "publish",
    status: "published",
    updatedAt: "2026-10-11T00:00:01.000Z",
  });
  expect(confirmsModerationCommand(saved, "item", "publish", date.toISOString())).toEqual(saved);
});
it("accepts complete Unicode previews and retained notes with PostgreSQL character limits", async () => {
  const detail = await moderation.detail(actor, "item");
  detail.item.excerpt = "😀".repeat(350);
  detail.item.body = "😀".repeat(100000);
  detail.item.tags = ["😀".repeat(30)];
  detail.history[0].notes = "😀".repeat(2000);
  expect(moderationDetailSchema.safeParse(detail).success).toBe(true);
  for (const invalid of [
    { ...detail, item: { ...detail.item, excerpt: "😀".repeat(351) } },
    { ...detail, item: { ...detail.item, body: "😀".repeat(100001) } },
    { ...detail, item: { ...detail.item, tags: ["😀".repeat(31)] } },
    { ...detail, history: [{ ...detail.history[0], notes: "😀".repeat(2001) }] },
  ])
    expect(moderationDetailSchema.safeParse(invalid).success).toBe(false);
});
it("blocks publishing an incomplete legacy preview without issuing a write", async () => {
  mocks.detail.mockResolvedValueOnce({ item: { ...row, truncated: true } });
  await expect(
    moderation.command(actor, "item", {
      action: "publish",
      notes: "Reviewed",
      expectedUpdatedAt: date.toISOString(),
    }),
  ).rejects.toMatchObject({ code: "CONTENT_REVIEW_TOO_LARGE" });
  expect(mocks.command).not.toHaveBeenCalled();
});
it.each([
  { actorId: "foreign" },
  { action: "delete" },
  { notes: "x" },
  { expectedUpdatedAt: "bad" },
  { ownerId: "foreign" },
])("rejects unsafe command overrides %j", (extra) =>
  expect(
    moderationCommandSchema.safeParse({
      action: "archive",
      notes: "Reviewed",
      expectedUpdatedAt: date.toISOString(),
      ...extra,
    }).success,
  ).toBe(false),
);
it.each([
  {},
  null,
  { id: "other", action: "publish", status: "published", updatedAt: "2026-10-11T00:00:01.000Z" },
  { id: "item", action: "publish", status: "draft", updatedAt: "2026-10-11T00:00:01.000Z" },
  { id: "item", action: "publish", status: "published", updatedAt: date.toISOString() },
  { id: "item", action: "publish", status: "published", updatedAt: "2026-10-10T00:00:00.000Z" },
])("rejects wrong/stale/uncertain decision acknowledgement %j", (value) =>
  expect(confirmsModerationCommand(value, "item", "publish", date.toISOString())).toBeNull(),
);
it("keeps RU/EN copy complete", () => {
  expect(Object.keys(moderationCopy("ru"))).toEqual(Object.keys(moderationCopy("en")));
  expect(Object.keys(discoveryStreamCopy("ru"))).toEqual(Object.keys(discoveryStreamCopy("en")));
});
