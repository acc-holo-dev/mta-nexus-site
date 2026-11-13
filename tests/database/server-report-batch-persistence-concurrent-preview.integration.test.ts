import { describe, expect, it } from "vitest";
import {
  comments,
  db,
  eq,
  fixture,
  id,
  preview,
  reportsRepository,
  selection,
  setupServerReportBatchPersistence,
} from "../helpers/server-report-batch-persistence-harness";

setupServerReportBatchPersistence();

describe("server report batch persistence: concurrent preview", () => {
  it("permits one concurrent reviewed batch outcome and refuses edits beyond a bounded comment preview", async () => {
    const f = await fixture(),
      text = `${"🙂".repeat(5000)}original-tail`;
    await db.update(comments).set({ text }).where(eq(comments.id, f.comment.id));
    const reviewed = await preview(f);
    expect(reviewed.comment?.truncated).toBe(true);
    await db
      .update(comments)
      .set({ text: `${"🙂".repeat(5000)}changed-tail` })
      .where(eq(comments.id, f.comment.id));
    await expect(
      reportsRepository.decideDiscussionBatch(
        f.staff.id,
        f.item.id,
        f.comment.id,
        { ...selection(f), previewRevision: reviewed.previewRevision },
        [id("aud"), id("aud")],
        f.staff.currentToken,
      ),
    ).rejects.toMatchObject({ code: "REPORT_BATCH_CHANGED" });
    const fresh = await preview(f);
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        reportsRepository.decideDiscussionBatch(
          f.staff.id,
          f.item.id,
          f.comment.id,
          { ...selection(f), previewRevision: fresh.previewRevision },
          [id("aud"), id("aud")],
          f.staff.currentToken,
        ),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "REPORT_STATE_CHANGED" },
    });
  });
});
