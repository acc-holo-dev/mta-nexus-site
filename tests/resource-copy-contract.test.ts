import { resourceCopyCommandSchema, resourceCopyMetadataSchema } from "@nexus/validation";
import { expect, it } from "vitest";
import { confirmedResourceCopy } from "../apps/web/src/lib/resource-copy-confirmation";
import { resourceCopyCopy, resourceCopyError } from "../apps/web/src/lib/resource-copy-i18n";
import {
  resourceCopiesPageParams,
  resourceCopiesQuery,
  resourceCopyId,
} from "../apps/web/src/lib/resource-copy-query";
import { command, metadata, receipt, sourceId, targetId } from "./resource-copy-fixtures";

it("normalizes editable fields and refuses ownership, price, status and artifact injection", () => {
  expect(
    resourceCopyCommandSchema.parse({
      ...command,
      title: "  New resource  ",
      slug: " new-resource ",
    }),
  ).toEqual(command);
  for (const extra of [
    "actorId",
    "authorId",
    "organizationId",
    "price",
    "status",
    "metadata",
    "builds",
    "snapshot",
  ])
    expect(resourceCopyCommandSchema.safeParse({ ...command, [extra]: "bad" }).success).toBe(false);
});
it.each(["Abc", "a--b", "ab", "a_b", "a/b", "-abc", "abc-"])("refuses unsafe slug %j", (slug) =>
  expect(resourceCopyCommandSchema.safeParse({ ...command, slug }).success).toBe(false),
);
it("bounds metadata and canonicalizes requirements", () => {
  expect(
    resourceCopyMetadataSchema.parse({ ...metadata, compatibility: { dependencies: [" CORE "] } })
      .compatibility.dependencies,
  ).toEqual(["core"]);
  for (const input of [
    { ...metadata, tags: Array(21).fill("tag") },
    { ...metadata, description: "bad" },
    { ...metadata, compatibility: { dependencies: ["core", "CORE"] } },
    { ...metadata, compatibility: { dependencies: [], storageKey: "private" } },
  ])
    expect(resourceCopyMetadataSchema.safeParse(input).success).toBe(false);
});
it("confirms only the exact persisted independent draft metadata", () => {
  const body = JSON.parse(JSON.stringify({ receipt, replayed: false }));
  expect(confirmedResourceCopy(body, sourceId, command, metadata)).toBe(targetId);
  for (const invalid of [
    null,
    {},
    { ...body, replayed: undefined },
    { ...body, receipt: { ...body.receipt, createdAt: "yesterday" } },
    { ...body, receipt: { ...body.receipt, source: { id: "someone_else" } } },
    { ...body, receipt: { ...body.receipt, target: { ...body.receipt.target, slug: "another" } } },
    { ...body, receipt: { ...body.receipt, metadata: { ...metadata, tags: [] } } },
  ])
    expect(confirmedResourceCopy(invalid, sourceId, command, metadata)).toBeNull();
});
it("rejects ambiguous history and all preview/detail queries", () => {
  expect(resourceCopiesQuery(new URLSearchParams("page=2&days=90"), true)).toEqual({
    page: 2,
    days: 90,
  });
  for (const value of [
    "page=0",
    "days=31",
    "days=7&days=30",
    "actorId=other",
    "page=1%0A",
    "page=10000",
  ])
    expect(() => resourceCopiesQuery(new URLSearchParams(value), true)).toThrow();
  expect(() => resourceCopiesQuery(new URLSearchParams("page=1"))).toThrow();
  expect(() => resourceCopiesPageParams({ days: ["7", "30"] })).toThrow();
  for (const id of ["../secret", "good\n", "a".repeat(161), ""])
    expect(() => resourceCopyId(id)).toThrow();
});
it("covers independent RU/EN notices and recovery messages", () => {
  for (const locale of ["ru", "en"] as const) {
    const copy = resourceCopyCopy(locale);
    expect(copy.notice.length).toBeGreaterThan(100);
    expect(copy.statuses.archived).toBeTruthy();
    for (const code of [
      "RESOURCE_COPY_INVALID",
      "RESOURCE_COPY_SOURCE_CHANGED",
      "RESOURCE_COPY_REQUEST_CONFLICT",
      "RESOURCE_COPY_SLUG_TAKEN",
      "RESOURCE_COPY_LIMIT",
      "RESOURCE_COPY_SOURCE_RESTRICTED",
      "RESOURCE_COPY_METADATA_INVALID",
      "RESOURCE_COPY_CREATE_FORBIDDEN",
      "UNAUTHORIZED",
      "NOT_FOUND",
      "RATE_LIMIT_EXCEEDED",
    ])
      expect(resourceCopyError(locale, code)).not.toBe(copy.retry);
  }
});
