import { describe, expect, it } from "vitest";
import {
  and,
  auditEvents,
  comments,
  content,
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
} from "./helpers/server-report-batch-persistence-harness";

setupServerReportBatchPersistence();

describe("server report batch persistence: decide selected", () => {
  it("atomically decides only the selected reports, keeps comment/count and records one audit per case", async () => {
    const f = await fixture(),
      reviewed = await preview(f);
    await reportsRepository.decideDiscussionBatch(
      f.staff.id,
      f.item.id,
      f.comment.id,
      { ...selection(f), previewRevision: reviewed.previewRevision },
      [id("aud"), id("aud")],
      f.staff.currentToken,
    );
    const stored = await db
      .select()
      .from(reports)
      .where(inArray(reports.id, [f.a.id, f.b.id, f.third.id]));
    expect(
      stored
        .filter((row) => row.status === "resolved")
        .map((row) => row.id)
        .sort(),
    ).toEqual([f.a.id, f.b.id].sort());
    expect(stored.find((row) => row.id === f.third.id)?.status).toBe("open");
    expect(await db.select().from(comments).where(eq(comments.id, f.comment.id))).toHaveLength(1);
    expect((await db.select().from(content).where(eq(content.id, f.item.id)))[0].commentCount).toBe(
      1,
    );
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.actorId, f.staff.id), eq(auditEvents.action, "report.resolve"))),
    ).toHaveLength(2);
  });
});
