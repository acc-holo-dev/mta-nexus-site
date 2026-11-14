import { describe, expect, it } from "vitest";
import {
  buildRepository,
  builds,
  count,
  db,
  eq,
  fixture,
  present,
  resourceReleaseEvents,
} from "../helpers/resource-release-watches-harness";

describe("resource release watches: publication event evidence", () => {
  it("publication events require exact safe evidence, are immutable and roll back with a failed approval audit", async () => {
    const f = await fixture();
    try {
      const release = await f.release("1.0.0");
      const [event] = await db
        .select()
        .from(resourceReleaseEvents)
        .where(eq(resourceReleaseEvents.buildId, release.buildId));
      await expect(
        db
          .update(resourceReleaseEvents)
          .set({ version: "9.0.0" })
          .where(eq(resourceReleaseEvents.buildId, release.buildId)),
      ).rejects.toThrow();
      await expect(
        db.delete(resourceReleaseEvents).where(eq(resourceReleaseEvents.buildId, release.buildId)),
      ).rejects.toThrow();
      await expect(
        db.insert(resourceReleaseEvents).values({
          productId: f.id,
          buildId: release.buildId,
          version: "9.0.0",
          sha256Hash: present(event).sha256Hash,
          fileSizeBytes: 7,
        }),
      ).rejects.toThrow();
      const buildId = `bld_rw_rollback_${f.key}`;
      await db.insert(builds).values({
        id: buildId,
        productId: f.id,
        version: "2.0.0",
        status: "pending_review",
        scanStatus: "clean",
        scanner: "integration-scanner",
        scannedAt: new Date(),
        storageKey: "fixtures/rollback.zip",
        sha256Hash: "a".repeat(64),
        fileSizeBytes: 7,
      });
      await expect(
        buildRepository.moderatePending(
          buildId,
          "approve",
          { ...release.audit, targetId: buildId },
          1,
          `tok_${f.staff}`,
        ),
      ).rejects.toThrow();
      const [total] = await db
        .select({ total: count() })
        .from(resourceReleaseEvents)
        .where(eq(resourceReleaseEvents.buildId, buildId));
      expect(total.total).toBe(0);
      expect(present(await buildRepository.findById(buildId)).status).toBe("pending_review");
    } finally {
      await f.cleanup();
    }
  });
});
