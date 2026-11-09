import { describe, expect, it } from "vitest";
import {
  and,
  audit,
  auditEvents,
  db,
  eq,
  fixture,
  id,
  inArray,
  preview,
  reports,
  reportsRepository,
  selection,
  setupServerReportBatchPersistence,
} from "../helpers/server-report-batch-persistence-harness";

setupServerReportBatchPersistence();

describe("server report batch persistence: audit rollback", () => {
  it("rolls back the entire batch if any mandatory audit cannot be stored", async () => {
    const f = await fixture(),
      reviewed = await preview(f),
      duplicate = audit(f.staff.id, f.item.id, "fixture.audit");
    await db.insert(auditEvents).values(duplicate);
    await expect(
      reportsRepository.decideDiscussionBatch(
        f.staff.id,
        f.item.id,
        f.comment.id,
        { ...selection(f), previewRevision: reviewed.previewRevision },
        [id("aud"), duplicate.id],
        f.staff.currentToken,
      ),
    ).rejects.toThrow();
    const stored = await db
      .select()
      .from(reports)
      .where(inArray(reports.id, [f.a.id, f.b.id]));
    expect(stored.every((row) => row.status === "open" && row.moderatorNotes === null)).toBe(true);
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.actorId, f.staff.id), eq(auditEvents.action, "report.resolve"))),
    ).toHaveLength(0);
  });
});
