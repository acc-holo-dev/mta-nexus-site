import { expect, it } from "vitest";
import {
  encodeSupportMessageCursor,
  parseSupportMessageQuery,
  supportMessageHref,
} from "../apps/web/src/lib/support-message-discovery-contract";

const id = `spm_${"a".repeat(24)}`,
  stamp = "2026-10-12T00:00:00.123456Z",
  cursor = {
    version: 1 as const,
    context: "a".repeat(64),
    until: stamp,
    id,
    direction: "older" as const,
  };
it("round trips a precise cursor and preserves reviewed export/navigation filters", () => {
  const filters = { group: "staff" as const, query: " 100%_ ".trim(), cursor };
  const href = supportMessageHref("/messages", filters, { until: stamp });
  expect(parseSupportMessageQuery(new URL(href, "https://nexus.test").searchParams)).toEqual({
    ...filters,
    until: stamp,
    focus: undefined,
  });
  const next = { ...cursor, direction: "newer" as const };
  expect(
    parseSupportMessageQuery(
      new URL(supportMessageHref("/messages", filters, { cursor: next }), "https://nexus.test")
        .searchParams,
    )?.cursor,
  ).toEqual(next);
  expect(supportMessageHref("/messages", filters, { fresh: true })).toBe(
    "/messages?group=staff&q=100%25_",
  );
});
it("supports focused permalinks and removes focus when continuing through a cursor", () => {
  const filters = { group: "all" as const, query: "", focus: id };
  expect(parseSupportMessageQuery(new URLSearchParams({ focus: id }))).toMatchObject(filters);
  expect(supportMessageHref("/messages", filters, { cursor })).not.toContain("focus");
});
it.each([
  "group=owner",
  "group=all&group=staff",
  "q=x&q=y",
  "actorId=victim",
  "cursor=",
  "cursor=!!!!",
  "until=0000-01-01T00:00:00.000000Z",
  "until=2026-02-30T00:00:00.000000Z",
  "until=2026-10-12T00:00:00.123Z",
  `focus=${id}&q=x`,
  `focus=${id}&group=staff`,
  `q=${" ".repeat(81)}`,
  `focus=${id}&focus=${id}`,
])("rejects malformed or ambiguous query %s", (query) => {
  expect(parseSupportMessageQuery(new URLSearchParams(query))).toBeNull();
});
it.each([
  { ...cursor, raw: "secret" },
  { ...cursor, direction: "next" },
  { ...cursor, version: 2 },
  { ...cursor, id: "foreign-id" },
  { ...cursor, until: "invalid" },
])("rejects a noncanonical cursor contract %j", (value) => {
  expect(
    parseSupportMessageQuery(
      new URLSearchParams({ cursor: Buffer.from(JSON.stringify(value)).toString("base64url") }),
    ),
  ).toBeNull();
});
it("rejects cursor/window disagreement and padded base64 encodings", () => {
  const encoded = encodeSupportMessageCursor(cursor);
  expect(
    parseSupportMessageQuery(
      new URLSearchParams({ cursor: encoded, until: "2026-10-12T00:00:01.000000Z" }),
    ),
  ).toBeNull();
  expect(parseSupportMessageQuery(new URLSearchParams({ cursor: `${encoded}=` }))).toBeNull();
  expect(parseSupportMessageQuery(new URLSearchParams({ cursor: encoded, focus: id }))).toBeNull();
});
