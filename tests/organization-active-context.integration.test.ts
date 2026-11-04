import { randomUUID } from "node:crypto";
import {
  db,
  organizationMembers,
  organizationRepository,
  organizations,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";

const userIds: string[] = [];
const organizationIds: string[] = [];

afterEach(async () => {
  if (organizationIds.length) {
    await db
      .delete(organizationMembers)
      .where(inArray(organizationMembers.organizationId, organizationIds));
    await db.delete(organizations).where(inArray(organizations.id, organizationIds));
  }
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  organizationIds.length = 0;
  userIds.length = 0;
});

async function actor() {
  const key = randomUUID().replaceAll("-", "");
  const id = `usr_context_${key}`;
  userIds.push(id);
  return userRepository.create({
    id,
    username: `ctx_${key}`,
    email: `${key}@nexus.test`,
    displayName: "Context fixture",
    role: "user",
  });
}

it("returns an active context only for its current owner or member", async () => {
  const owner = await actor();
  const member = await actor();
  const stranger = await actor();
  const key = randomUUID();
  const orgId = `org_context_${key}`;
  organizationIds.push(orgId);
  const organization = await organizationRepository.create({
    id: orgId,
    ownerId: owner.id,
    name: "Context fixture",
    slug: `context-${key}`,
  });
  const memberId = `mem_context_${key}`;
  await db.insert(organizationMembers).values({
    id: memberId,
    organizationId: orgId,
    userId: member.id,
    role: "admin",
    permissions: [],
  });

  const summary = { id: orgId, name: organization.name, slug: organization.slug };
  expect(await organizationRepository.findUserContext(orgId, owner.id)).toEqual({
    ...summary,
    role: "owner",
  });
  expect(await organizationRepository.findUserContext(orgId, member.id)).toEqual({
    ...summary,
    role: "admin",
  });
  expect(await organizationRepository.findUserContext(orgId, stranger.id)).toBeNull();
  await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
  expect(await organizationRepository.findUserContext(orgId, member.id)).toBeNull();
});
