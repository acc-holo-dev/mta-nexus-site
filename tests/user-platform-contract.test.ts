import { expect, it } from "vitest";
import {
  parseContentPage,
  contentPageHref,
  writerCreateSchema,
  writerUpdateSchema,
  profileUpdateSchema,
} from "../apps/web/src/lib/user-platform-contract";
import { getUserPlatformCopy, userPlatformError } from "../apps/web/src/lib/user-platform-copy";
import {
  parseEditableContent,
  parseEditableProfile,
} from "../apps/web/src/lib/user-platform-client";
const fields = {
  title: "Title",
  body: "A sufficiently long body.",
  excerpt: "",
  coverImageUrl: "",
  tags: [],
};
it.each(["NaN", "Infinity", "0", "-1", "1e3", "10000", ["2", "3"]])(
  "bounds the requested page %j",
  (page) => {
    expect(parseContentPage({ page }).page).toBe(1);
  },
);
it("preserves valid filters across pages and caps search text", () => {
  const filters = parseContentPage({
    page: "9999",
    type: "question",
    status: "draft",
    q: "  Lua %_  ",
  });
  expect(filters).toEqual({ page: 9999, query: "Lua %_", type: "question", status: "draft" });
  const url = new URL(contentPageHref("/workspace/content", filters, 2), "http://test");
  expect(url.searchParams.get("q")).toBe("Lua %_");
  expect(url.searchParams.get("type")).toBe("question");
  expect(url.searchParams.get("status")).toBe("draft");
  expect(url.searchParams.get("page")).toBe("2");
  expect(parseContentPage({ q: "x".repeat(150) }).query).toHaveLength(120);
});
it("uses the same duplicate-parameter policy in API and server-rendered pages", () => {
  expect(parseContentPage(new URLSearchParams("page=2&page=3&type=news&type=post&q=lua"))).toEqual(
    parseContentPage({ page: ["2", "3"], type: ["news", "post"], q: "lua" }),
  );
});
it("caps text and tag counts and rejects authoritative fields", () => {
  const input = { ...fields, type: "article", slug: "my-article" };
  expect(writerCreateSchema.safeParse(input).success).toBe(true);
  expect(writerCreateSchema.safeParse({ ...input, body: "x".repeat(20_001) }).success).toBe(false);
  expect(writerCreateSchema.safeParse({ ...input, tags: Array(11).fill("lua") }).success).toBe(
    false,
  );
  expect(writerCreateSchema.safeParse({ ...input, status: "published" }).success).toBe(false);
  expect(
    writerUpdateSchema.safeParse({
      ...fields,
      expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
      slug: "other-url",
    }).success,
  ).toBe(false);
});
it.each([
  "javascript:alert(1)",
  "https://user:password@example.test/image",
  "https://example.test/ bad",
])("rejects unsafe avatar %s", (avatarUrl) => {
  expect(
    profileUpdateSchema.safeParse({
      displayName: "User",
      bio: "",
      avatarUrl,
      expectedUpdatedAt: "2026-10-10T12:00:00Z",
    }).success,
  ).toBe(false);
});
it("accepts cleared image fields and strict saved representations", () => {
  expect(
    parseEditableContent({
      ...fields,
      excerpt: null,
      coverImageUrl: null,
      id: "cnt_1",
      slug: "article",
      type: "article",
      status: "draft",
      updatedAt: "2026-10-10T12:00:00Z",
    }),
  ).toMatchObject({ excerpt: "", coverImageUrl: "" });
  expect(
    parseEditableProfile({
      id: "usr_1",
      username: "account",
      displayName: "Account",
      bio: "",
      avatarUrl: "",
      updatedAt: "2026-10-10T12:00:00Z",
    }),
  ).not.toBeNull();
  expect(parseEditableProfile({ id: "usr_1", displayName: "Account" })).toBeNull();
});
it("keeps RU/EN keys complete and never exposes unknown server error text", () => {
  const en = getUserPlatformCopy("en"),
    ru = getUserPlatformCopy("ru");
  expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  expect(Object.values(ru).every((value) => value.length > 0)).toBe(true);
  expect(userPlatformError("ru", "CONFLICT")).toBe(ru.CONFLICT);
  expect(userPlatformError("en", "database_password=secret")).toBe(en.unavailable);
});
