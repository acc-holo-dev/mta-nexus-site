import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ page: vi.fn(), resolve: vi.fn() }));
vi.mock("@nexus/db", () => ({
  publicationFeedRepository: { page: mocks.page, resolvePublicScope: mocks.resolve },
}));
import { publicationFeedService as service } from "../apps/web/src/lib/services/publication-feed-service";
beforeEach(() => vi.clearAllMocks());
it("projects bounded public DTOs, sanitizes media and preserves microsecond cursors", async () => {
  const row = {
    id: "content",
    slug: "article",
    title: "Title",
    type: "post",
    excerpt: "Excerpt",
    coverImageUrl: "javascript:alert(1)",
    commentCount: 4,
    publishedAt: new Date("2026-10-10T12:00:00.123Z"),
    authorId: "author",
    username: "u name",
    displayName: "Writer",
    avatarUrl: "data:text/html,secret",
    organizationName: "Team",
    organizationSlug: "a/b",
    serverName: null,
    serverSlug: null,
    productName: null,
    productSlug: null,
    email: "private@nexus.test",
    cursorTime: "2026-10-10T12:00:00.123456Z",
  };
  mocks.page.mockResolvedValue({
    items: [row],
    hasMore: true,
    nextCursor: { createdAt: row.cursorTime, id: row.id },
  });
  const result = await service.page(
    { kind: "following", actorId: "actor" },
    { query: "", type: undefined, source: undefined, cursor: undefined },
  );
  expect(result.items[0]).toMatchObject({
    image: null,
    author: { username: "u name", avatar: null },
    organization: { href: "/organizations/a%2Fb" },
    server: null,
    product: null,
  });
  expect(JSON.parse(result.nextCursor as string).createdAt).toBe(row.cursorTime);
  expect(JSON.stringify(result)).not.toContain("private@nexus.test");
  expect(result.items[0]).not.toHaveProperty("authorId");
});
it("rejects invalid/missing public profiles with no broad user projection", async () => {
  for (const handle of ["", "a/b", "a b", "x".repeat(129)])
    await expect(service.resolve("user", handle)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.resolve).not.toHaveBeenCalled();
  mocks.resolve.mockResolvedValue(null);
  await expect(service.resolve("organization", "team")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
