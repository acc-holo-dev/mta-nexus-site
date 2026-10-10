import { expect, it } from "vitest";
import {
  discoverHref,
  parseDiscoverApiQuery,
  parseDiscoverQuery,
} from "../apps/web/src/lib/discover-query";
import {
  followCommandSchema,
  followPageSchema,
  parseFollowQuery,
} from "../apps/web/src/lib/follow-workspace-contract";
import { followCopy } from "../apps/web/src/lib/follow-workspace-copy";
import { discoveryCopy } from "../apps/web/src/lib/discovery-copy";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
it("preserves all active server filters across canonical page links", () => {
  const state = parseDiscoverQuery({
    type: "servers",
    q: "RP & Race",
    page: "4",
    verified: "1",
    sort: "name",
    language: "ru",
    region: "EU",
    gameMode: "role play",
  });
  const url = discoverHref(state);
  const query = new URL(url, "http://nexus.test").searchParams;
  expect(parseDiscoverApiQuery(query)).toEqual(state);
  expect(query.get("page")).toBe("4");
  expect(discoverHref({ ...state, type: "creators", page: 1 }, "/developers")).toBe(
    "/developers?q=RP+%26+Race&verified=1&sort=name",
  );
});
it("clears irrelevant filters and bounds human-readable page input", () => {
  expect(
    parseDiscoverQuery({
      type: "content",
      verified: "1",
      sort: "name",
      language: "ru",
      contentType: "question",
      page: "9999",
    }),
  ).toMatchObject({
    verified: false,
    sort: "newest",
    language: "",
    contentType: "question",
    page: 1000,
  });
  expect(parseDiscoverQuery({ page: "Infinity" }).page).toBe(1);
});
it.each(["news", "update"])("retains the legacy %s publication type in Discovery", (type) => {
  expect(
    parseDiscoverApiQuery(new URLSearchParams({ type: "content", contentType: type })),
  ).toMatchObject({ type: "content", contentType: type });
});
it("rejects invalid microsecond follow cursors and round-trips valid ones", () => {
  const cursor = { id: "follow", createdAt: "2026-10-10T12:00:00.123456Z" };
  expect(
    parseFollowQuery(
      new URLSearchParams({ type: "organization", q: " Team ", cursor: JSON.stringify(cursor) }),
    ),
  ).toEqual({ type: "organization", query: "Team", cursor });
  for (const value of [
    "broken",
    JSON.stringify({ ...cursor, createdAt: "2026-02-30T12:00:00.123456Z" }),
    JSON.stringify({ ...cursor, unexpected: true }),
  ])
    expect(parseFollowQuery(new URLSearchParams({ cursor: value }))).toBeNull();
});
it("allows only exact target commands and bounded consistent read pages", () => {
  expect(
    followCommandSchema.safeParse({ targetType: "user", targetId: "target", actorId: "other" })
      .success,
  ).toBe(false);
  expect(followCommandSchema.safeParse({ targetType: "content", targetId: "target" }).success).toBe(
    false,
  );
  expect(followPageSchema.safeParse({ items: [], hasMore: true, nextCursor: null }).success).toBe(
    false,
  );
});
it("provides matching RU/EN actions, filters and errors", () => {
  expect(Object.keys(followCopy("ru"))).toEqual(Object.keys(followCopy("en")));
  expect(Object.keys(discoveryCopy("ru"))).toEqual(Object.keys(discoveryCopy("en")));
  expect(followCopy("ru").unconfirmed).toMatch(/подтверждён/u);
});
it("localizes persisted follower notifications without interpreting arbitrary messages", () => {
  const copy = { approved: "", rejected: "", version: "", notes: "" };
  const notice = {
    title: "New Follower",
    message: "@member started following your activity.",
    data: null,
  };
  expect(formatNotification(notice, copy, "ru")).toEqual({
    title: "Новый подписчик",
    message: "@member подписался на вашу активность.",
  });
  const unknown = { ...notice, message: "<script>other content</script>" };
  expect(formatNotification(unknown, copy, "ru")).toEqual({
    title: unknown.title,
    message: unknown.message,
  });
});
