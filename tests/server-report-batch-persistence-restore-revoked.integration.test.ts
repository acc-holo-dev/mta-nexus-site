import { describe, expect, it } from "vitest";
import {
  and,
  audit,
  auditEvents,
  author,
  db,
  eq,
  fixture,
  organizationMembers,
  setupServerReportBatchPersistence,
} from "./helpers/server-report-batch-persistence-harness";

setupServerReportBatchPersistence();

describe("server report batch persistence: restore revoked", () => {
  it("revoked delegation and moderator-protected archives cannot be restored by old managers", async () => {
    const f = await fixture();
    await author.mutate(
      f.item.id,
      f.manager.id,
      f.item.updatedAt,
      "published",
      null,
      audit(f.manager.id, f.item.id, "content.archived_by_server", f.server.id),
      undefined,
      f.server.id,
    );
    const history = await author.history(
      f.item.id,
      f.manager.id,
      undefined,
      undefined,
      f.server.id,
    );
    await db
      .update(organizationMembers)
      .set({ permissions: [] })
      .where(
        and(
          eq(organizationMembers.organizationId, f.org.id),
          eq(organizationMembers.userId, f.manager.id),
        ),
      );
    await expect(
      author.restore(
        f.item.id,
        f.manager.id,
        history.item.revision,
        audit(f.manager.id, f.item.id, "content.restored_by_server"),
        undefined,
        f.server.id,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      author.history(f.item.id, f.manager.id, undefined, undefined, f.server.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.insert(auditEvents).values({
      ...audit(f.staff.id, f.item.id, "content.archived"),
      actorType: "admin",
      createdAt: new Date(Date.now() + 1000),
    });
    await expect(
      author.restore(
        f.item.id,
        f.owner.id,
        history.item.revision,
        audit(f.owner.id, f.item.id, "content.restored_by_server"),
        undefined,
        f.server.id,
      ),
    ).rejects.toMatchObject({ code: "PUBLICATION_RESTORE_DENIED" });
  });
});
