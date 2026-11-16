import { describe, expect, it } from "vitest";
import {
  and,
  db,
  eq,
  fixture,
  resourceReleaseWatches,
  watches,
} from "../helpers/resource-release-watches-harness";

describe("resource release watches: batch audit rollback", () => {
  it("rolls a watch batch back when the required audit cannot be written", async () => {
    const f = await fixture();
    try {
      await f.release("1.0.0");
      await f.start();
      await expect(
        watches.disableBatch({
          userId: f.buyer,
          currentToken: `tok_${f.buyer}`,
          command: { items: [{ productId: f.id, expectedRevision: 1 }] },
          auditId: `aud_rw_enroll_${f.key}`,
        }),
      ).rejects.toThrow();
      const [watch] = await db
        .select()
        .from(resourceReleaseWatches)
        .where(
          and(
            eq(resourceReleaseWatches.userId, f.buyer),
            eq(resourceReleaseWatches.productId, f.id),
          ),
        );
      expect(watch).toMatchObject({ enabled: true, revision: 1 });
    } finally {
      await f.cleanup();
    }
  });
});
