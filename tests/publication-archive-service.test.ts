import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ page: vi.fn(), resolve: vi.fn() }));
vi.mock("@nexus/db", () => ({
  publicationFeedRepository: { page: state.page, resolvePublicScope: state.resolve },
}));
import { publicationFeedService as service } from "../apps/web/src/lib/services/publication-feed-service";
import {
  parsePublicationQuery,
  publicationPageQuery,
  type PublicationQuery,
} from "../apps/web/src/lib/publication-feed-contract";
const scope = { kind: "server" as const, id: "server" };
const boundary = { createdAt: "2026-10-11T00:00:00.123456Z", id: "boundary" };
beforeEach(() => {
  vi.clearAllMocks();
  state.page.mockResolvedValue({
    items: [],
    hasMore: true,
    nextCursor: boundary,
    previousCursor: boundary,
  });
  state.resolve.mockResolvedValue({ id: "server", name: "Server" });
});
async function continuedQuery(): Promise<PublicationQuery> {
  const first = await service.page(scope, publicationPageQuery({ q: "Lua", type: "news" }, false));
  const parsed = parsePublicationQuery(
    new URLSearchParams({ q: "Lua", type: "news", cursor: first.nextCursor ?? "" }),
    false,
    true,
  );
  if (!parsed) throw new Error("Expected continuation");
  return parsed;
}
it("resolves an active public server through the existing narrow scope lookup", async () => {
  expect(await service.resolve("server", "my-server")).toEqual({ id: "server", name: "Server" });
  expect(state.resolve).toHaveBeenCalledWith("server", "my-server");
  state.resolve.mockResolvedValue(null);
  await expect(service.resolve("server", "private-server")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("preserves context and exact keys in older and newer cursors", async () => {
  const result = await service.page(scope, publicationPageQuery({ q: "Lua" }, false));
  const older = JSON.parse(result.nextCursor ?? "");
  const newer = JSON.parse(result.previousCursor ?? "");
  expect(older).toMatchObject({ ...boundary, version: 1, direction: "older" });
  expect(newer).toMatchObject({
    ...boundary,
    version: 1,
    direction: "newer",
    context: older.context,
  });
  expect(older.context).toMatch(/^[a-f0-9]{64}$/u);
  expect(JSON.stringify(result)).not.toContain('"server"');
});
it("accepts a cursor again only with its original source and normalized filters", async () => {
  const query = await continuedQuery();
  state.page.mockClear();
  await service.page(scope, query);
  expect(state.page).toHaveBeenCalledOnce();
  expect(state.page).toHaveBeenCalledWith(scope, query);
});
it.each([
  { scope: { kind: "server" as const, id: "other" }, filters: {} },
  { scope: { kind: "organization" as const, id: "server" }, filters: {} },
  { scope: { kind: "user" as const, id: "server" }, filters: {} },
  { scope: { kind: "following" as const, actorId: "server" }, filters: {} },
  { scope, filters: { query: "Other" } },
  { scope, filters: { type: "update" } },
  { scope, filters: { author: "writer" } },
  { scope, filters: { tag: "MTA" } },
])("rejects a rebound cursor %j before any database query", async (input) => {
  const query = await continuedQuery();
  state.page.mockClear();
  await expect(service.page(input.scope, { ...query, ...input.filters })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
    statusCode: 400,
  });
  expect(state.page).not.toHaveBeenCalled();
});
it("binds following-feed cursors to the session account and source", async () => {
  const first = await service.page(
    { kind: "following", actorId: "actor" },
    publicationPageQuery({ source: "server" }),
  );
  const query = parsePublicationQuery(
    new URLSearchParams({ source: "server", cursor: first.nextCursor ?? "" }),
  );
  if (!query) throw new Error("Expected cursor");
  state.page.mockClear();
  for (const [actorId, source] of [
    ["other", "server"],
    ["actor", "user"],
  ] as const)
    await expect(
      service.page({ kind: "following", actorId }, { ...query, source }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.page).not.toHaveBeenCalled();
});
it("keeps tag and author case normalization consistent when resuming", async () => {
  const first = await service.page(scope, {
    ...publicationPageQuery(),
    author: "Writer",
    tag: "Lua",
  });
  const query = parsePublicationQuery(
    new URLSearchParams({ author: "writer", tag: "lua", cursor: first.nextCursor ?? "" }),
    false,
    true,
  );
  if (!query) throw new Error("Expected query");
  await expect(service.page(scope, query)).resolves.toHaveProperty("hasMore", true);
});
it.each([{ type: "post" }, { source: "server" }])(
  "denies non-editorial and follow-only server requests %j",
  async (filters) => {
    await expect(
      service.page(scope, { ...publicationPageQuery(), ...filters } as PublicationQuery),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.page).not.toHaveBeenCalled();
  },
);
