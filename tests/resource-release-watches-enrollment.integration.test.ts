import { describe, expect, it } from "vitest";
import {
  buildRepository,
  db,
  eq,
  fixture,
  present,
  productLifecycleRepository,
  productRepository,
  resourceReleaseWatches,
  worker,
} from "./helpers/resource-release-watches-harness";

describe("resource release watches: enrollment and exact-release delivery", () => {
  it("enrollment skips old events, and concurrent workers create one exact-release notice", async () => {
    const f = await fixture();
    try {
      await f.release("1.0.0");
      await f.start();
      await worker.runBatch(100);
      expect(await f.inbox()).toHaveLength(0);
      const release = await f.release("2.0.0");
      await Promise.all([worker.runBatch(100), worker.runBatch(100)]);
      const notices = await f.inbox();
      expect(notices).toHaveLength(1);
      expect(notices[0].data).toMatchObject({ kind: "resource_release", version: "2.0.0" });
      expect(
        await buildRepository.moderatePending(
          release.buildId,
          "approve",
          { ...release.audit, id: `aud_rw_replay_${f.key}` },
          1,
          `tok_${f.staff}`,
        ),
      ).toBeNull();
      const product = present(await productRepository.findById(f.id));
      await productRepository.updateManagedDetails(
        f.id,
        { id: f.owner, role: "developer" },
        {
          title: "Reviewed updated title",
          shortDescription: "",
          description: "Reviewed updated description",
          tags: [],
        },
        {
          id: `aud_rw_edit_${f.key}`,
          actorId: f.owner,
          actorType: "user",
          action: "product.details_updated",
          targetId: f.id,
          targetType: "product",
        },
        product.updatedAt,
      );
      const changed = present(await productRepository.findById(f.id));
      await productLifecycleRepository.transition({
        actorId: f.owner,
        productId: f.id,
        action: "submit",
        expectedUpdatedAt: changed.updatedAt,
        reason: "Review changed resource description",
        auditId: `aud_rw_submit_${f.key}`,
      });
      const pending = present(await buildRepository.findById(release.buildId));
      present(
        await buildRepository.moderatePending(
          release.buildId,
          "approve",
          { ...release.audit, id: `aud_rw_reapprove_${f.key}` },
          pending.revision ?? 1,
          `tok_${f.staff}`,
        ),
      );
      await worker.runBatch(100);
      expect(await f.inbox()).toHaveLength(1);
      await expect(
        db
          .update(resourceReleaseWatches)
          .set({ lastSequence: 0n })
          .where(eq(resourceReleaseWatches.productId, f.id)),
      ).rejects.toThrow();
    } finally {
      await f.cleanup();
    }
  });
});
