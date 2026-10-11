import { expect, it } from "vitest";
import {
  confirmedReactionMutation,
  confirmedReactionRemoval,
  parseReactionPage,
  reactionCommandSchema,
  reactionPageHref,
  reactionPageSchema,
  reactionStateSchema,
} from "../apps/web/src/lib/content-reaction-contract";
import { reactionCopy } from "../apps/web/src/lib/content-reaction-copy";
import { trustCopy } from "../apps/web/src/lib/public-user-trust-copy";
const mutation = {
  contentId: "content",
  slug: "guide",
  reaction: "helpful",
  counts: { helpful: 1, thanks: 0, insight: 0 },
  changed: true,
};
it.each([
  { reaction: "👍" },
  { reaction: "unknown" },
  {},
  { reaction: "helpful", actorId: "other" },
  { reaction: null, targetType: "product" },
])("rejects forged reaction command %j", (value) =>
  expect(reactionCommandSchema.safeParse(value).success).toBe(false),
);
it.each(["helpful", "thanks", "insight", null])("accepts explicit desired state %s", (reaction) =>
  expect(reactionCommandSchema.safeParse({ reaction }).success).toBe(true),
);
it("confirms only the exact saved target and desired reaction", () => {
  expect(confirmedReactionMutation(mutation, "content", "guide", "helpful")).toEqual(mutation);
  for (const value of [
    { ...mutation, contentId: "other" },
    { ...mutation, slug: "other" },
    { ...mutation, reaction: "thanks" },
    { ...mutation, counts: { helpful: -1, thanks: 0, insight: 0 } },
    { ...mutation, changed: undefined },
    null,
  ])
    expect(confirmedReactionMutation(value, "content", "guide", "helpful")).toBeNull();
  expect(confirmedReactionRemoval({ contentId: "content", removed: true }, "content")).toBe(true);
  for (const value of [
    { contentId: "other", removed: true },
    { contentId: "content", removed: false },
    { contentId: "content", removed: true, title: "private" },
  ])
    expect(confirmedReactionRemoval(value, "content")).toBe(false);
});
it.each([
  "actorId=victim",
  "q=one&q=two",
  "reaction=unknown",
  "cursor=bad",
  "q=%0Ax",
  "q=x%7F",
  `q=${"x".repeat(101)}`,
])("rejects invalid private page %s", (query) =>
  expect(parseReactionPage(new URLSearchParams(query))).toBeNull(),
);
it("preserves filters and microsecond cursor precision in continuation URLs", () => {
  const cursor = JSON.stringify({
    version: 1,
    createdAt: "2026-10-11T00:00:00.123456Z",
    id: "content",
    context: "a".repeat(64),
  });
  const parsed = parseReactionPage(
    new URLSearchParams({ q: " Lua & MTA ", reaction: "thanks", cursor }),
  );
  expect(parsed?.query).toBe("Lua & MTA");
  if (!parsed) throw new Error("Invalid fixture");
  const url = new URL(reactionPageHref(parsed, cursor), "https://nexus.test");
  expect(parseReactionPage(url.searchParams)).toEqual(parsed);
  expect(new URL(reactionPageHref(parsed), url).searchParams.has("cursor")).toBe(false);
});
it("does not accept counters without a full saved state or inconsistent pagination", () => {
  expect(reactionStateSchema.safeParse(mutation).success).toBe(false);
  expect(reactionPageSchema.safeParse({ items: [], hasMore: true, nextCursor: null }).success).toBe(
    false,
  );
});
it("keeps RU/EN keys complete for both finished scenarios", () => {
  for (const copy of [reactionCopy, trustCopy]) {
    expect(Object.keys(copy("en"))).toEqual(Object.keys(copy("ru")));
    for (const value of Object.values(copy("ru"))) expect(value).not.toBe("");
  }
});
