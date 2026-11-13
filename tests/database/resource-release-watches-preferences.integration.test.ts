import { describe, expect, it } from "vitest";
import {
  db,
  eq,
  fixture,
  notificationPreferences,
  worker,
} from "../helpers/resource-release-watches-harness";

describe("resource release watches: commerce notification preferences", () => {
  it("disabled commerce preferences consume release work without replay after preferences change", async () => {
    const f = await fixture();
    try {
      await f.release("1.0.0");
      await f.start();
      await db
        .insert(notificationPreferences)
        .values({ id: `npr_rw_${f.key}`, userId: f.buyer, commerceEnabled: false });
      await f.release("2.0.0");
      await worker.runBatch(100);
      expect(await f.inbox()).toHaveLength(0);
      await db
        .update(notificationPreferences)
        .set({ commerceEnabled: true })
        .where(eq(notificationPreferences.userId, f.buyer));
      await worker.runBatch(100);
      expect(await f.inbox()).toHaveLength(0);
      await f.release("3.0.0");
      await worker.runBatch(100);
      expect(await f.inbox()).toHaveLength(1);
    } finally {
      await f.cleanup();
    }
  });
});
