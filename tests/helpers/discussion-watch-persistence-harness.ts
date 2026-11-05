import { randomUUID } from "node:crypto";
import {
  auditEvents,
  comments,
  content,
  db,
  followWorkspaceRepository as followsRepository,
  notificationRepository,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach } from "vitest";

const actors: string[] = [];

afterEach(async () => {
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(content).where(inArray(content.authorId, actors));
    await db.delete(users).where(inArray(users.id, actors));
  }
  actors.length = 0;
});

/** Create a disposable discussion participant tracked for afterEach cleanup. */
export async function actor() {
  const key = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_watch_${key}`,
    username: `watch_${key}`,
    email: `${key}@nexus.test`,
    displayName: "Participant",
    role: "user",
  });
  actors.push(user.id);
  return user;
}

/** Insert a published content row owned by the given author. */
export async function publication(authorId: string) {
  const [row] = await db
    .insert(content)
    .values({
      id: `cnt_${randomUUID()}`,
      slug: `watch-${randomUUID()}`,
      authorId,
      type: "post",
      status: "published",
      title: "Publication secret marker",
      body: "Body secret marker",
    })
    .returning();
  return row;
}

/** Insert a comment (optionally nested) and bump the parent publication count. */
export async function reply(contentId: string, authorId: string, parentId?: string) {
  const [row] = await db
    .insert(comments)
    .values({
      id: `cmt_${randomUUID()}`,
      contentId,
      authorId,
      parentId,
      text: "Comment secret marker",
      createdAt: sql`clock_timestamp()`,
    })
    .returning();
  await db
    .update(content)
    .set({ commentCount: sql`${content.commentCount}+1` })
    .where(eq(content.id, contentId));
  return row;
}

export const subscribe = (actorId: string, contentId: string) =>
  followsRepository.setFollowing(actorId, "content", contentId, true, `fol_${randomUUID()}`);

export const deliver = (recipientId: string, contentId: string, commentId: string) =>
  notificationRepository.createDiscussionReplyWithPush({ recipientId, contentId, commentId });
