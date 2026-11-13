import { describe, expect, it } from "vitest";
import {
  audit,
  author,
  comments,
  content,
  db,
  eq,
  fixture,
  setupServerReportBatchPersistence,
} from "../helpers/server-report-batch-persistence-harness";

setupServerReportBatchPersistence();

describe("server report batch persistence: restore once", () => {
  it("restores a delegated server archive once under current grants without changing attribution or original text", async () => {
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
    expect(history.item.recoverable).toBe(true);
    const results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        author.restore(
          f.item.id,
          f.manager.id,
          history.item.revision,
          audit(f.manager.id, f.item.id, "content.restored_by_server", f.server.id),
          undefined,
          f.server.id,
        ),
      ),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [stored] = await db.select().from(content).where(eq(content.id, f.item.id));
    expect(stored).toMatchObject({
      authorId: f.writer.id,
      serverId: f.server.id,
      body: "Original full text",
      tags: ["lua"],
      status: "draft",
      publishedAt: null,
      commentCount: 1,
    });
    expect(await db.select().from(comments).where(eq(comments.id, f.comment.id))).toHaveLength(1);
  });
});
