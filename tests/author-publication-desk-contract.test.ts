import { expect, it } from "vitest";
import {
  authorPublicationDeskHref,
  authorPublicationRestoreSchema,
  confirmedAuthorPublicationRestore,
  parseAuthorPublicationDeskQuery,
  parseAuthorPublicationHistoryQuery,
} from "../apps/web/src/lib/author-publication-desk-contract";
import {
  parsePublicationQuery,
  publicationHref,
} from "../apps/web/src/lib/publication-feed-contract";

const point = {
  id: "article",
  createdAt: "2026-10-11T00:00:00.123456Z",
  context: "a".repeat(64),
  direction: "older",
  version: 1,
};
it("round trips the bounded author filters and exact cursor and resets continuation when searching", () => {
  const filters = parseAuthorPublicationDeskQuery(
    new URLSearchParams({
      q: " %_\\ ",
      status: "archived",
      type: "news",
      source: "organization",
      tag: " Lua ",
      cursor: JSON.stringify(point),
    }),
  );
  expect(filters).toMatchObject({
    query: "%_\\",
    status: "archived",
    type: "news",
    source: "organization",
    tag: "Lua",
    cursor: point,
  });
  if (!filters) throw Error("Missing filters");
  const href = authorPublicationDeskHref(filters, JSON.stringify(point));
  expect(parseAuthorPublicationDeskQuery(new URL(href, "https://nexus.test").searchParams)).toEqual(
    filters,
  );
  expect(authorPublicationDeskHref(filters)).not.toContain("cursor=");
});
it.each([
  "page=2",
  "status=bad",
  "source=resource",
  "type=resource",
  "type=review",
  "q=x&q=y",
  "tag=%00",
  "q=%7F",
  `q=${"x".repeat(101)}`,
  `tag=${"x".repeat(31)}`,
  "cursor=null",
  "actorId=foreign",
])("rejects invalid author filters %s", (query) =>
  expect(parseAuthorPublicationDeskQuery(new URLSearchParams(query))).toBeNull(),
);
it.each([
  { ...point, createdAt: "2026-02-30T00:00:00.123456Z" },
  { ...point, createdAt: "2026-10-11T00:00:00.123Z" },
  { ...point, id: "with/slash" },
  { ...point, version: 2 },
  { ...point, extra: true },
])("rejects an invalid desk cursor %j", (cursor) =>
  expect(
    parseAuthorPublicationDeskQuery(new URLSearchParams({ cursor: JSON.stringify(cursor) })),
  ).toBeNull(),
);
it("accepts only older history continuation and no private scope parameters", () => {
  expect(parseAuthorPublicationHistoryQuery(new URLSearchParams())).toEqual({ cursor: undefined });
  expect(
    parseAuthorPublicationHistoryQuery(new URLSearchParams({ cursor: JSON.stringify(point) }))
      ?.cursor,
  ).toEqual(point);
  for (const params of [
    new URLSearchParams({ cursor: JSON.stringify({ ...point, direction: "newer" }) }),
    new URLSearchParams("q=word"),
    new URLSearchParams("cursor=x&cursor=y"),
  ])
    expect(parseAuthorPublicationHistoryQuery(params)).toBeNull();
});
it("requires an exact observed restore revision with no status, author or publication fields", () => {
  expect(
    authorPublicationRestoreSchema.safeParse({ expectedRevision: point.createdAt }).success,
  ).toBe(true);
  for (const input of [
    null,
    {},
    { expectedRevision: "bad" },
    { expectedRevision: point.createdAt, authorId: "foreign" },
    { expectedRevision: point.createdAt, status: "published" },
    { expectedRevision: point.createdAt, body: "rewrite" },
  ])
    expect(authorPublicationRestoreSchema.safeParse(input).success).toBe(false);
});
it("requires an exact advancing draft acknowledgement", () => {
  const result = { id: "article", status: "draft", revision: "2026-10-11T00:00:00.124456Z" };
  expect(confirmedAuthorPublicationRestore(result, "article", point.createdAt)).toBe(true);
  for (const value of [
    { ...result, id: "foreign" },
    { ...result, status: "published" },
    { ...result, revision: point.createdAt },
    { ...result, revision: "bad" },
    { ...result, body: "unsolicited" },
  ])
    expect(confirmedAuthorPublicationRestore(value, "article", point.createdAt)).toBe(false);
});
it.each(["user", "organization", "server"])(
  "keeps an exact followed %s target in feed navigation",
  (source) => {
    const query = parsePublicationQuery(
      new URLSearchParams({ source, target: "selected", q: "topic" }),
    );
    if (!query) throw Error("Missing filters");
    expect(query.target).toBe("selected");
    const href = publicationHref("/workspace/feed", query, JSON.stringify(point));
    expect(new URL(href, "https://nexus.test").searchParams.get("target")).toBe("selected");
  },
);
it.each([
  "target=selected",
  "source=product&target=resource",
  "source=server&target=",
  "source=user&target=one&target=two",
  "source=server&target=with%2Fslash",
])("rejects an ambiguous followed target %s", (query) =>
  expect(parsePublicationQuery(new URLSearchParams(query))).toBeNull(),
);
it("keeps target scoping private to the following feed", () =>
  expect(
    parsePublicationQuery(new URLSearchParams({ source: "user", target: "selected" }), false),
  ).toBeNull());
