import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  db,
  contentDiscussionRepository as discussion,
  userRepository,
  comments,
  content,
  users,
} from "@nexus/db";
const actors: string[] = [];
afterEach(async () => {
  if (actors.length) {
    await db.delete(content).where(inArray(content.authorId, actors));
    await db.delete(users).where(inArray(users.id, actors));
  }
  actors.length = 0;
});
async function fixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_focus_${suffix}`,
    username: `focus_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Public writer",
  });
  actors.push(user.id);
  const [item] = await db
    .insert(content)
    .values({
      id: `cnt_focus_${randomUUID()}`,
      slug: `focus-${randomUUID()}`,
      authorId: user.id,
      title: "Discussion",
      body: "Public discussion body",
      type: "post",
      status: "published",
    })
    .returning();
  return { user, item };
}
it("loads a linked older comment beyond the first page and continues across microseconds without duplicates", async () => {
  const f = await fixture();
  const rows = Array.from({ length: 55 }, (_, i) => ({
    id: `cmt_focus_${String(i).padStart(3, "0")}_${randomUUID()}`,
    contentId: f.item.id,
    authorId: f.user.id,
    text: `Message ${i}`,
    createdAt: sql`'2026-10-11T00:00:00.000000Z'::timestamptz + ${i} * interval '1 microsecond'`,
  }));
  await db.insert(comments).values(rows);
  expect((await discussion.page(f.item.id)).items.map((row) => row.id)).not.toContain(rows[25].id);
  const focused = await discussion.page(f.item.id, undefined, { focusId: rows[25].id });
  expect(focused.items.map((row) => row.id)).toEqual(
    rows
      .slice(6, 26)
      .reverse()
      .map((row) => row.id),
  );
  expect(focused.nextCursor?.createdAt).toBe("2026-10-11T00:00:00.000006Z");
  if (!focused.nextCursor) throw new Error("Expected focused continuation");
  const older = await discussion.page(f.item.id, focused.nextCursor);
  expect(older.items.map((row) => row.id)).toEqual(
    rows
      .slice(0, 6)
      .reverse()
      .map((row) => row.id),
  );
  expect(new Set([...focused.items, ...older.items].map((row) => row.id)).size).toBe(26);
});
it("matches literal wildcard text and public author identity before bounded paging", async () => {
  const f = await fixture();
  const ids = [`cmt_${randomUUID()}`, `cmt_${randomUUID()}`];
  await db.insert(comments).values(
    ids.map((id, i) => ({
      id,
      authorId: f.user.id,
      contentId: f.item.id,
      text: i ? "Lua discussion" : "Literal %_ token",
    })),
  );
  expect(
    (await discussion.page(f.item.id, undefined, { query: "%_" })).items.map((row) => row.id),
  ).toEqual([ids[0]]);
  expect(
    (await discussion.page(f.item.id, undefined, { query: f.user.username })).items,
  ).toHaveLength(2);
  expect((await discussion.page(f.item.id, undefined, { query: f.user.email })).items).toHaveLength(
    0,
  );
});
it("rejects foreign, removed, draft and archived focused comments", async () => {
  const f = await fixture(),
    other = await fixture(),
    id = `cmt_${randomUUID()}`;
  await db
    .insert(comments)
    .values({ id, contentId: f.item.id, authorId: f.user.id, text: "Focused text" });
  await expect(discussion.page(other.item.id, undefined, { focusId: id })).rejects.toMatchObject({
    code: "COMMENT_FOCUS_NOT_FOUND",
  });
  for (const status of ["draft", "archived"] as const) {
    await db.update(content).set({ status }).where(eq(content.id, f.item.id));
    await expect(discussion.page(f.item.id, undefined, { focusId: id })).rejects.toMatchObject({
      code: "COMMENT_FOCUS_NOT_FOUND",
    });
  }
  await db.update(content).set({ status: "published" }).where(eq(content.id, f.item.id));
  await db.delete(comments).where(eq(comments.id, id));
  await expect(discussion.page(f.item.id, undefined, { focusId: id })).rejects.toMatchObject({
    code: "COMMENT_FOCUS_NOT_FOUND",
  });
});
