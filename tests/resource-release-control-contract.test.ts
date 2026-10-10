import { expect, it } from "vitest";
import { resourceModerationTarget } from "@nexus/domain";
import { libraryReleaseCommandSchema, resourceModerationCommandSchema } from "@nexus/validation";
import {
  confirmedLibraryRelease,
  confirmedResourceModeration,
} from "../apps/web/src/lib/resource-release-control-confirmation";
import {
  libraryReleaseQuery,
  resourceModerationQuery,
} from "../apps/web/src/lib/resource-release-control-query";
const revision = "2026-10-10T12:00:00.000Z";
it("always releases a suspension into a draft requiring a new review", () => {
  expect(resourceModerationTarget("suspended", "release")).toBe("draft");
  for (const status of ["draft", "published", "pending_review", "archived"] as const) {
    expect(resourceModerationTarget(status, "release")).toBeNull();
    expect(resourceModerationTarget(status, "suspend")).toBe("suspended");
  }
  expect(resourceModerationTarget("suspended", "suspend")).toBeNull();
});
it.each([
  {},
  { mode: "fixed", buildId: "../file", expectedRevision: 1 },
  { mode: "latest", expectedRevision: 1, buildId: "bld" },
  { mode: "latest", expectedRevision: -1 },
  { mode: "latest", expectedRevision: 1, userId: "another" },
])("rejects invalid or authority-bearing preferences %j", (value) => {
  expect(libraryReleaseCommandSchema.safeParse(value).success).toBe(false);
});
it.each([
  "2026-10-10T12:00:00Z",
  "2026-10-10T12:00:00.000+03:00",
  "2026-02-30T12:00:00.000Z",
  "invalid",
])("rejects a noncanonical moderation revision %s", (expectedUpdatedAt) => {
  expect(
    resourceModerationCommandSchema.safeParse({
      action: "release",
      expectedUpdatedAt,
      reason: "Evidence",
    }).success,
  ).toBe(false);
});
it("requires a publisher-visible reason and forbids injected commercial changes", () => {
  expect(
    resourceModerationCommandSchema.parse({
      action: "suspend",
      expectedUpdatedAt: revision,
      reason: "  Reviewed evidence  ",
    }).reason,
  ).toBe("Reviewed evidence");
  for (const extra of [
    { reason: " " },
    { reason: "x".repeat(2001) },
    { status: "published" },
    { commissionBps: 0 },
  ]) {
    expect(
      resourceModerationCommandSchema.safeParse({
        action: "suspend",
        expectedUpdatedAt: revision,
        reason: "Reviewed evidence",
        ...extra,
      }).success,
    ).toBe(false);
  }
});
it.each([
  "userId=other",
  "page=1&page=2",
  "page=01",
  "page=1001",
  "filter=private",
  "filter=updates&filter=all",
])("rejects untrusted library query %s", (query) => {
  expect(() => libraryReleaseQuery(new URLSearchParams(query))).toThrow();
});
it("allows only bounded staff queue queries", () => {
  expect(
    resourceModerationQuery(new URLSearchParams("status=suspended&query=%20a%20&page=2")),
  ).toEqual({ status: "suspended", query: "a", page: 2 });
  for (const query of [
    "status=suspended&status=published",
    "authorId=another",
    "page=0",
    `query=${"a".repeat(101)}`,
  ])
    expect(() => resourceModerationQuery(new URLSearchParams(query))).toThrow();
});
it("confirms the requested resource and build, including a harmless replay", () => {
  const command = { mode: "fixed" as const, expectedRevision: 2, buildId: "bld_a" };
  const result = {
    productId: "prd_a",
    selection: { revision: 3, mode: "fixed", buildId: "bld_a" },
  };
  expect(confirmedLibraryRelease(result, "prd_a", command)).toBe(true);
  expect(
    confirmedLibraryRelease(
      { ...result, selection: { ...result.selection, revision: 2 } },
      "prd_a",
      command,
    ),
  ).toBe(true);
  for (const value of [
    { success: true },
    { ...result, productId: "other" },
    { ...result, selection: { ...result.selection, revision: 4 } },
    { ...result, selection: { ...result.selection, buildId: "other" } },
  ])
    expect(confirmedLibraryRelease(value, "prd_a", command)).toBe(false);
});
it("never confirms a restored publication or a generic success response", () => {
  const command = {
    action: "release" as const,
    expectedUpdatedAt: revision,
    reason: "Reviewed evidence",
  };
  const product = { id: "prd_a", status: "draft", updatedAt: "2026-10-10T12:00:00.001Z" };
  expect(confirmedResourceModeration({ product }, "prd_a", command)).toBe(true);
  for (const value of [
    { success: true },
    { product: { ...product, status: "published" } },
    { product: { ...product, id: "other" } },
    { product: { ...product, updatedAt: revision } },
  ])
    expect(confirmedResourceModeration(value, "prd_a", command)).toBe(false);
});
