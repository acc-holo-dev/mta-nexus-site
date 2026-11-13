import { describe, expect, it } from "vitest";
import {
  audit,
  auditEvents,
  author,
  db,
  eq,
  fixture,
  notifications,
  setupServerReportBatchPersistence,
} from "../helpers/server-report-batch-persistence-harness";

setupServerReportBatchPersistence();

describe("server report batch persistence: restore audit failure", () => {
  it("server restore audit failure rolls back its draft and inbox changes", async () => {
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
      ),
      duplicate = audit(f.manager.id, f.item.id, "fixture.audit");
    await db.insert(auditEvents).values(duplicate);
    const before = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, f.writer.id));
    await expect(
      author.restore(
        f.item.id,
        f.manager.id,
        history.item.revision,
        duplicate,
        undefined,
        f.server.id,
      ),
    ).rejects.toThrow();
    expect(
      (await author.history(f.item.id, f.owner.id, undefined, undefined, f.server.id)).item,
    ).toMatchObject({ status: "archived", revision: history.item.revision });
    expect(
      await db.select().from(notifications).where(eq(notifications.recipientId, f.writer.id)),
    ).toHaveLength(before.length);
  });
});
