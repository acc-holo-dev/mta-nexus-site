import { expect, it } from "vitest";
import {
  parsePublicationPageQuery,
  parsePublicationQuery,
  publicationHref,
  publicationPageSchema,
} from "../apps/web/src/lib/publication-feed-contract";
const cursor = {
  version: 1,
  createdAt: "2026-10-11T00:00:00.123456Z",
  id: "cnt_1",
  context: "a".repeat(64),
  direction: "newer" as const,
};
it("round-trips a shareable filtered page with exact microseconds in both URL and API", () => {
  const params = {
    q: " Lua & UI ",
    type: "news",
    author: " Writer ",
    tag: " MTA:SA ",
    cursor: JSON.stringify(cursor),
  };
  const filters = parsePublicationPageQuery(params, false, true);
  expect(filters).toMatchObject({ query: "Lua & UI", author: "Writer", tag: "MTA:SA", cursor });
  if (!filters) throw new Error("Expected valid page");
  const href = publicationHref("/servers/my-server/updates", filters, JSON.stringify(cursor));
  expect(
    parsePublicationQuery(new URL(href, "http://nexus.test").searchParams, false, true),
  ).toEqual(filters);
  expect(
    new URL(
      publicationHref("/servers/my-server/updates", filters),
      "http://nexus.test",
    ).searchParams.has("cursor"),
  ).toBe(false);
});
it.each([
  { cursor: "broken" },
  { cursor: JSON.stringify({ ...cursor, direction: "sideways" }) },
  { cursor: JSON.stringify({ ...cursor, createdAt: "2026-02-30T00:00:00.123456Z" }) },
  { cursor: JSON.stringify({ createdAt: cursor.createdAt, id: cursor.id }) },
  { cursor: JSON.stringify({ ...cursor, actorId: "victim" }) },
  { cursor: [JSON.stringify(cursor), JSON.stringify(cursor)] },
  { type: "post" },
  { source: "server" },
  { author: "writer/other" },
  { author: ["one", "two"] },
  { tag: "x".repeat(31) },
  { q: "x".repeat(101) },
  { q: "a\u0000b" },
  { tag: "a\nb" },
  { serverId: "other" },
])("rejects malformed or injected archive page %j before querying", (params) => {
  expect(parsePublicationPageQuery(params, false, true)).toBeNull();
});
it("accepts all editorial server types, literal tags and canonical author filters", () => {
  for (const type of ["article", "news", "devlog", "update", "announcement"]) {
    expect(
      parsePublicationPageQuery({ type, author: "writer", tag: "%_" }, false, true),
    ).toMatchObject({ type, author: "writer", tag: "%_" });
  }
  expect(parsePublicationPageQuery({ type: "question" }, false)).toMatchObject({
    type: "question",
  });
});
it("bounds tags while retaining compatibility with earlier summary clients", () => {
  expect(
    publicationPageSchema.safeParse({
      items: [],
      hasMore: false,
      nextCursor: null,
      previousCursor: JSON.stringify(cursor),
    }).success,
  ).toBe(true);
  expect(
    publicationPageSchema.safeParse({
      items: [],
      hasMore: false,
      nextCursor: null,
      previousCursor: "x".repeat(513),
    }).success,
  ).toBe(false);
});
