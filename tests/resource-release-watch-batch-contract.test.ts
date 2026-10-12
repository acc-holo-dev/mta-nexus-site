import { expect, it } from "vitest";
import { resourceReleaseWatchDisableCommandSchema } from "@nexus/validation";
import { confirmedResourceReleaseWatchBatch } from "../apps/web/src/lib/resource-release-watch-batch-confirmation";
import {
  resourceReleaseWatchesQuery,
  resourceReleaseWatchesUrl,
} from "../apps/web/src/lib/resource-release-watches-query";
const command = {
  items: [
    { productId: "prd_a", expectedRevision: 1 },
    { productId: "prd_b", expectedRevision: 3 },
  ],
};
it("accepts only unique, bounded, revision-scoped disable batches and canonicalizes order", () => {
  expect(
    resourceReleaseWatchDisableCommandSchema.parse({ items: [...command.items].reverse() }),
  ).toEqual(command);
  for (const value of [
    { items: [] },
    { items: [...command.items, command.items[0]] },
    { ...command, userId: "foreign" },
    { ...command, enabled: true },
    { items: [{ productId: "prd_a", expectedRevision: 0 }] },
    { items: [{ productId: "../private", expectedRevision: 1 }] },
    {
      items: Array.from({ length: 21 }, (_, i) => ({ productId: `prd_${i}`, expectedRevision: 1 })),
    },
  ])
    expect(resourceReleaseWatchDisableCommandSchema.safeParse(value).success).toBe(false);
});
it("confirms only the exact complete disabled successor state", () => {
  const result = {
    changedCount: 2,
    items: command.items.map((item) => ({
      productId: item.productId,
      revision: item.expectedRevision + 1,
      enabled: false,
      updatedAt: "2026-10-12T00:00:00.000Z",
    })),
  };
  expect(confirmedResourceReleaseWatchBatch(result, command)).toBe(true);
  expect(confirmedResourceReleaseWatchBatch({ ...result, changedCount: 0 }, command)).toBe(true);
  for (const value of [
    { success: true },
    { ...result, changedCount: 1 },
    { ...result, items: [result.items[0]] },
    { ...result, items: [...result.items].reverse() },
    { ...result, extra: true },
    { ...result, items: result.items.map((row) => ({ ...row, enabled: true })) },
    { ...result, items: result.items.map((row) => ({ ...row, revision: 9 })) },
    {
      ...result,
      items: result.items.map((row) => ({ ...row, updatedAt: "2026-02-30T00:00:00.000Z" })),
    },
    { ...result, items: result.items.map((row) => ({ ...row, lastSequence: "private" })) },
  ])
    expect(confirmedResourceReleaseWatchBatch(value, command)).toBe(false);
});
it("bounds title search and keeps it across pagination and filters", () => {
  const query = resourceReleaseWatchesQuery(
    new URLSearchParams("query=%20core%20&filter=enabled&page=2"),
  );
  expect(query).toEqual({ query: "core", filter: "enabled", page: 2 });
  expect(
    resourceReleaseWatchesQuery(
      new URL(
        resourceReleaseWatchesUrl(query.filter, query.page, query.query),
        "https://nexus.test",
      ).searchParams,
    ),
  ).toEqual(query);
  for (const text of [
    "query=a&query=b",
    `query=${"x".repeat(101)}`,
    "page=1001",
    "actorId=foreign",
  ])
    expect(() => resourceReleaseWatchesQuery(new URLSearchParams(text))).toThrow();
});
