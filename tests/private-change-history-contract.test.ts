import { expect, it } from "vitest";
import {
  organizationChangeHistorySchema,
  parseOrganizationChangeHistoryQuery,
} from "../apps/web/src/lib/organization-governance-contract";
import { privateChangeHistoryCopy } from "../apps/web/src/lib/private-change-history-copy";
import {
  changeHistoryHref,
  encodeChangeHistoryCursor,
} from "../apps/web/src/lib/private-change-history-query";
import {
  parseProfileChangeHistoryQuery,
  profileChangeHistorySchema,
} from "../apps/web/src/lib/profile-change-history-contract";

const stamp = "2026-10-12T00:00:00.123456Z",
  context = "a".repeat(64);
const cursor = { version: 1 as const, until: stamp, context, id: "audit_1" };
it("round-trips exact profile windows and retains active filters in page/export links", () => {
  const filters = parseProfileChangeHistoryQuery(
    new URLSearchParams({
      period: "30",
      group: "privacy",
      cursor: encodeChangeHistoryCursor(cursor),
    }),
  );
  expect(filters).toMatchObject({ period: "30", group: "privacy", query: "", cursor });
  if (!filters) throw Error("Missing filters");
  const link = changeHistoryHref("/api/account/profile/history/export", filters, { until: stamp });
  expect(parseProfileChangeHistoryQuery(new URL(link, "https://nexus.test").searchParams)).toEqual({
    ...filters,
    until: stamp,
  });
  expect(changeHistoryHref("/settings/history", filters, { fresh: true })).toBe(
    "/settings/history?period=30&group=privacy",
  );
});
it("supports canonical organization account search and old before links", () => {
  expect(
    parseOrganizationChangeHistoryQuery(
      new URLSearchParams({ group: "team", period: "7", q: " Owner " }),
    ),
  ).toMatchObject({ group: "team", period: "7", query: "Owner" });
  expect(
    parseOrganizationChangeHistoryQuery(new URLSearchParams({ before: "audit_old" })),
  ).toMatchObject({ period: "all", group: "all", query: "", before: "audit_old" });
});
it.each([
  "period=0",
  "period=999",
  "group=security",
  "group=privacy&group=profile",
  "period=7&period=30",
  "actorId=foreign",
  "before=legacy",
  "q=anything",
  "q=",
  "cursor=broken",
  "cursor=x&cursor=y",
  "until=2026-02-30T00:00:00.123456Z",
  "until=0000-01-01T00:00:00.000000Z",
  "until=2026-10-12T00:00:00.123Z",
])("rejects invalid profile query %s before storage", (query) =>
  expect(parseProfileChangeHistoryQuery(new URLSearchParams(query))).toBeNull(),
);
it.each([
  "group=privacy",
  "period=7&before=legacy",
  "group=team&before=legacy",
  "q=Owner&before=legacy",
  "before=x&before=y",
  "before=x&cursor=x",
  `q=${"x".repeat(81)}`,
  `q=${"%20".repeat(81)}`,
  "until=x",
  "scope=staff",
])("rejects invalid organization query %s", (query) =>
  expect(parseOrganizationChangeHistoryQuery(new URLSearchParams(query))).toBeNull(),
);
it.each([
  { ...cursor, version: 2 },
  { ...cursor, unexpected: "private" },
  { ...cursor, context: "short" },
  { ...cursor, id: "bad/path" },
  { ...cursor, until: "2026-02-30T00:00:00.123456Z" },
])("rejects malformed cursor payloads %j", (value) => {
  expect(
    parseProfileChangeHistoryQuery(
      new URLSearchParams({ cursor: Buffer.from(JSON.stringify(value)).toString("base64url") }),
    ),
  ).toBeNull();
});
it("rejects noncanonical or mismatched cursor cutoffs", () => {
  expect(
    parseProfileChangeHistoryQuery(
      new URLSearchParams({ cursor: `${encodeChangeHistoryCursor(cursor)}=` }),
    ),
  ).toBeNull();
  expect(
    parseProfileChangeHistoryQuery(
      new URLSearchParams({
        cursor: encodeChangeHistoryCursor(cursor),
        until: "2026-10-12T00:00:00.123457Z",
      }),
    ),
  ).toBeNull();
});
const base = {
  username: "owner",
  until: stamp,
  period: "all",
  group: "all",
  items: [],
  hasMore: false,
  nextCursor: null,
};
it("requires bounded exact-time pages and excludes unexpected audit properties", () => {
  expect(profileChangeHistorySchema.safeParse(base).success).toBe(true);
  for (const input of [
    { ...base, hasMore: true },
    { ...base, details: { email: "private" } },
    { ...base, until: "bad" },
    { ...base, items: Array(21).fill({}) },
  ])
    expect(profileChangeHistorySchema.safeParse(input).success).toBe(false);
  expect(
    organizationChangeHistorySchema.safeParse({
      organization: { id: "org", name: "Team", slug: "team" },
      until: stamp,
      period: "all",
      group: "all",
      query: "",
      items: [],
      hasMore: true,
      nextCursor: null,
    }).success,
  ).toBe(false);
});
it("keeps shared RU/EN groups, field labels and actions complete", () => {
  for (const locale of ["ru", "en"] as const) {
    const copy = privateChangeHistoryCopy(locale);
    expect(Object.keys(copy.groups)).toHaveLength(6);
    expect(Object.keys(copy.fieldNames)).toHaveLength(8);
    expect(Object.keys(copy.actions)).toHaveLength(3);
    expect(Object.keys(copy.periods)).toHaveLength(5);
  }
  expect(Object.keys(privateChangeHistoryCopy("en"))).toEqual(
    Object.keys(privateChangeHistoryCopy("ru")),
  );
});
it.each(["name", "slug"] as const)(
  "bounds current organization %s in exported history metadata",
  (field) => {
    expect(
      organizationChangeHistorySchema.safeParse({
        organization: { id: "org", name: "Team", slug: "team", [field]: "x".repeat(201) },
        until: stamp,
        period: "all",
        group: "all",
        query: "",
        items: [],
        hasMore: false,
        nextCursor: null,
      }).success,
    ).toBe(false);
  },
);
