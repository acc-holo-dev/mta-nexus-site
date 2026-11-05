import { describe, expect, it } from "vitest";
import {
  db,
  entitlements,
  eq,
  fixture,
  watches,
  worker,
} from "./helpers/resource-release-watches-harness";

describe("resource release watches: grant revocation", () => {
  it("revoked grants disable the watch without notification or changes to commercial state", async () => {
    const f = await fixture();
    try {
      await f.release("1.0.0");
      await f.start();
      await f.release("2.0.0");
      await db.delete(entitlements).where(eq(entitlements.resourceId, f.id));
      await worker.runBatch(100);
      expect(await f.inbox()).toHaveLength(0);
      expect(await watches.detail(f.buyer, f.id)).toMatchObject({ enabled: false, revision: 2 });
    } finally {
      await f.cleanup();
    }
  });
});
