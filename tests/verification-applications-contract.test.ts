import { expect, it } from "vitest";
import {
  confirmedVerificationApplicationAmend,
  parseVerificationApplicationsQuery as parse,
  verificationApplicationAmendSchema,
  verificationApplicationsHref,
} from "../apps/web/src/lib/verification-applications-contract";
import { verificationDecisionSchema } from "../apps/web/src/lib/verification-workspace-contract";

const revision = "a".repeat(64),
  next = "b".repeat(64),
  cursor = {
    id: "request",
    createdAt: "2026-10-11T00:00:00.123456Z",
    context: revision,
    direction: "older",
    version: 1,
  };
it("normalizes filters and preserves exact cursor precision through generated links", () => {
  const result = parse(
    new URLSearchParams({
      q: " Lua ",
      status: "pending",
      type: "developer",
      cursor: JSON.stringify(cursor),
    }),
  );
  expect(result).toMatchObject({ query: "Lua", status: "pending", type: "developer", cursor });
  if (!result) throw Error("Missing filters");
  const href = new URL(
    verificationApplicationsHref(result, JSON.stringify(cursor)),
    "https://nexus.test",
  );
  expect(href.searchParams.get("q")).toBe("Lua");
  expect(parse(href.searchParams)).toEqual(result);
  expect(verificationApplicationsHref(result)).not.toContain("cursor=");
});
it.each([
  "actorId=foreign",
  "q=one&q=two",
  "status=draft",
  "type=product",
  "page=9999",
  "q=%00",
  "cursor=bad",
  `q=${"x".repeat(101)}`,
])("rejects unsafe or unsupported filters %s", (query) =>
  expect(parse(new URLSearchParams(query))).toBeNull(),
);
it.each([
  { ...cursor, createdAt: "2026-10-11T00:00:00.123Z" },
  { ...cursor, createdAt: "2026-02-31T00:00:00.123456Z" },
  { ...cursor, id: "../../foreign" },
  { ...cursor, extra: true },
  { ...cursor, context: "x" },
  { ...cursor, direction: "bad" },
])("rejects invalid cursor %j", (value) =>
  expect(parse(new URLSearchParams({ cursor: JSON.stringify(value) }))).toBeNull(),
);
it.each([
  { status: "approved" },
  { requesterId: "foreign" },
  { expectedRevision: "bad" },
  { proofUrl: "javascript:alert(1)" },
  { proofUrl: "https://user:password@example.test" },
  { notes: "short" },
])("refuses forged evidence commands %j", (extra) =>
  expect(
    verificationApplicationAmendSchema.safeParse({
      expectedRevision: revision,
      proofUrl: "https://example.test/proof",
      notes: "My complete evidence",
      ...extra,
    }).success,
  ).toBe(false),
);
it("accepts Unicode evidence and a bound moderation decision", () => {
  expect(
    verificationApplicationAmendSchema.parse({
      expectedRevision: revision,
      proofUrl: "https://example.test/proof",
      notes: "  Мой подтверждённый опыт  ",
    }).notes,
  ).toBe("Мой подтверждённый опыт");
  expect(
    verificationDecisionSchema.parse({
      decision: "approved",
      reviewNotes: "Reviewed",
      expectedApplicationRevision: revision,
    }).expectedApplicationRevision,
  ).toBe(revision);
});
it.each([
  { id: "foreign", status: "pending", revision: next },
  { id: "request", status: "approved", revision: next },
  { id: "request", status: "pending", revision },
  { id: "request", status: "pending", revision: next, extra: true },
  null,
])("rejects uncertain acknowledgement %j", (value) =>
  expect(confirmedVerificationApplicationAmend(value, "request", revision)).toBe(false),
);
it("acknowledges only a new saved version of the same pending application", () =>
  expect(
    confirmedVerificationApplicationAmend(
      { id: "request", status: "pending", revision: next },
      "request",
      revision,
    ),
  ).toBe(true));

it("rejects links exceeding the bound after normalization", () => {
  expect(
    verificationApplicationAmendSchema.safeParse({
      expectedRevision: revision,
      proofUrl: `https://example.test/${"ж".repeat(500)}`,
      notes: "Complete evidence",
    }).success,
  ).toBe(false);
});
