import { expect, it } from "vitest";
import { resourceReleaseWatchEnableCommandSchema } from "@nexus/validation";
import { confirmedResourceReleaseWatchBatch } from "../apps/web/src/lib/resource-release-watch-batch-confirmation";
const command = {
  expectedCollectionRevision: 3,
  items: [
    { productId: "prd_a", expectedRevision: 0 },
    { productId: "prd_b", expectedRevision: 2 },
  ],
};
it("requires a current collection review and unique watch revisions, including new enrollments", () => {
  expect(
    resourceReleaseWatchEnableCommandSchema.parse({
      ...command,
      items: [...command.items].reverse(),
    }),
  ).toEqual(command);
  for (const value of [
    { items: command.items },
    { ...command, expectedCollectionRevision: 0 },
    { ...command, userId: "other" },
    { ...command, enabled: false },
    { ...command, items: [command.items[0], command.items[0]] },
    {
      ...command,
      items: Array.from({ length: 21 }, (_, i) => ({ productId: `prd_${i}`, expectedRevision: 0 })),
    },
    { ...command, items: [{ productId: "prd_a", expectedRevision: -1 }] },
  ])
    expect(resourceReleaseWatchEnableCommandSchema.safeParse(value).success).toBe(false);
});
it("confirms only the complete enabled successor state for collection enrollment", () => {
  const result = {
    changedCount: 2,
    items: command.items.map((item) => ({
      productId: item.productId,
      enabled: true,
      revision: item.expectedRevision + 1,
      updatedAt: "2026-10-12T00:00:00.000Z",
    })),
  };
  expect(confirmedResourceReleaseWatchBatch(result, command, true)).toBe(true);
  expect(confirmedResourceReleaseWatchBatch({ ...result, changedCount: 0 }, command, true)).toBe(
    true,
  );
  expect(confirmedResourceReleaseWatchBatch(result, command)).toBe(false);
  expect(
    confirmedResourceReleaseWatchBatch(
      { ...result, items: result.items.map((row) => ({ ...row, enabled: false })) },
      command,
      true,
    ),
  ).toBe(false);
});
