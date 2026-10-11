import { beforeEach, expect, it, vi } from "vitest";
const page = vi.hoisted(() => vi.fn());
vi.mock("@nexus/db", () => ({
  contentRepository: {},
  authorContentRepository: {},
  productRepository: {},
  serverRepository: {},
  discussionManagementRepository: {},
  contentDiscussionRepository: { page },
  discussionRevision: () => "a".repeat(64),
}));
import { contentService } from "../apps/web/src/lib/services/content-service";
const cursor = { createdAt: "2026-10-11T00:00:00.000123Z", id: "last" };
beforeEach(() => {
  vi.clearAllMocks();
  page.mockResolvedValue({ items: [], hasMore: true, nextCursor: cursor });
});
it("binds search continuation to article and exact query while retaining microseconds", async () => {
  const result = await contentService.pageDiscussion("content", undefined, { query: "Lua" });
  if (!result.nextCursor) throw new Error("Expected search continuation");
  expect(JSON.parse(result.nextCursor)).toEqual({ ...cursor, contentId: "content", query: "Lua" });
  await contentService.pageDiscussion("content", JSON.parse(result.nextCursor), { query: "Lua" });
  expect(page).toHaveBeenLastCalledWith(
    "content",
    { ...cursor, contentId: "content", query: "Lua" },
    { query: "Lua" },
  );
});
it.each([
  [{ ...cursor, contentId: "foreign", query: "Lua" }, { query: "Lua" }],
  [{ ...cursor, contentId: "content", query: "Other" }, { query: "Lua" }],
  [cursor, { query: "Lua" }],
  [{ ...cursor, contentId: "content", query: "Lua" }, {}],
] as const)(
  "rejects foreign, changed, missing or abandoned search scope before querying",
  async (value, options) => {
    await expect(contentService.pageDiscussion("content", value, options)).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    expect(page).not.toHaveBeenCalled();
  },
);
it("uses ordinary continuation after a focused comment and preserves existing non-search calls", async () => {
  const result = await contentService.pageDiscussion("content", undefined, { focusId: "older" });
  if (!result.nextCursor) throw new Error("Expected ordinary continuation");
  expect(JSON.parse(result.nextCursor)).toEqual(cursor);
  await contentService.pageDiscussion("content", cursor);
  expect(page).toHaveBeenLastCalledWith("content", cursor);
});
