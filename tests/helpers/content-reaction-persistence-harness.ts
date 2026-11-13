import { randomUUID } from "node:crypto";
import { db, sessionRepository, userRepository } from "@nexus/db";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach } from "vitest";
import {
  auditEvents,
  content,
  organizations,
  reactions,
  servers,
  users,
} from "../../site/packages/db/src/schema";

const tokens = new Map<string, string>();
const actorIds: string[] = [];
const contentIds: string[] = [];
const organizationIds: string[] = [];
const serverIds: string[] = [];

afterEach(async () => {
  if (contentIds.length) {
    await db.delete(reactions).where(inArray(reactions.targetId, contentIds));
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, contentIds));
    await db.delete(content).where(inArray(content.id, contentIds));
  }
  if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
  if (organizationIds.length)
    await db.delete(organizations).where(inArray(organizations.id, organizationIds));
  if (actorIds.length) await db.delete(users).where(inArray(users.id, actorIds));
  tokens.clear();
  actorIds.length = contentIds.length = organizationIds.length = serverIds.length = 0;
});

/** Create a disposable reaction participant with a live initiating session. */
export async function actor() {
  const suffix = randomUUID().replaceAll("-", "");
  const result = await userRepository.create({
    id: `usr_reaction_${suffix}`,
    email: `${suffix}@nexus.test`,
    username: `reaction_${suffix}`,
    displayName: "Reaction writer",
  });
  actorIds.push(result.id);
  const token = `reaction-token-${suffix}`;
  await sessionRepository.create({
    id: `ses_reaction_${suffix}`,
    userId: result.id,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  tokens.set(result.id, token);
  return result;
}

/** Insert a published content row owned by the given author. */
export async function publication(authorId: string, extra: Record<string, unknown> = {}) {
  const id = `cnt_reaction_${randomUUID()}`;
  contentIds.push(id);
  const [row] = await db
    .insert(content)
    .values({
      id,
      slug: `reaction-${randomUUID()}`,
      authorId,
      type: "article",
      status: "published",
      title: "Public guide",
      body: "Body",
      ...extra,
    })
    .returning();
  return row;
}

/** Build a content-reaction set command bound to the actor's initiating session. */
export const command = (
  actorId: string,
  slug: string,
  reaction: "helpful" | "thanks" | "insight" | null,
) => ({
  actorId,
  currentToken: tokens.get(actorId) ?? "",
  slug,
  reaction,
  reactionId: randomUUID(),
  auditId: randomUUID(),
});

/** Read the actor's reaction rows for one content target. */
export const ownRows = (actorId: string, id: string) =>
  db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.userId, actorId),
        eq(reactions.targetType, "content"),
        eq(reactions.targetId, id),
      ),
    );

/** Resolve the live initiating session token for an actor created by this harness. */
export const sessionToken = (actorId: string) => tokens.get(actorId) ?? "";

/** Track a server id for afterEach cleanup. */
export const trackServer = (id: string) => {
  serverIds.push(id);
};

/** Track an organization id for afterEach cleanup. */
export const trackOrganization = (id: string) => {
  organizationIds.push(id);
};

/** Create a deferred promise pair for lock-wait fixtures. */
export function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
