import { randomUUID, randomUUID as sessionUUID } from "node:crypto";
import {
  auditEvents,
  supportCaseRepository as cases,
  db,
  supportCases,
  sessionRepository as supportSessions,
  userRepository,
  users,
} from "@nexus/db";
import { inArray } from "drizzle-orm";
import { afterEach } from "vitest";

const userIds: string[] = [];
const caseIds: string[] = [];

/** Assert a fixture value was persisted. */
export function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing persisted fixture result");
  return value;
}

/** Stable short id for support workspace fixtures. */
export const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;

afterEach(async () => {
  if (caseIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, caseIds));
    await db.delete(supportCases).where(inArray(supportCases.id, caseIds));
  }
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  caseIds.length = 0;
  userIds.length = 0;
});

async function actor(role: "user" | "moderator" = "user") {
  const userId = id("usr");
  userIds.push(userId);
  return userRepository.create({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "Support fixture",
    role,
  });
}

/** Create a support case with requester, staff, and outsider actors. */
export async function fixture() {
  const owner = await actor(),
    staff = await actor("moderator"),
    other = await actor(),
    caseId = id("sup");
  caseIds.push(caseId);
  const supportCase = await cases.createWithInitialMessage(
    {
      id: caseId,
      requesterId: owner.id,
      category: "account",
      subject: "Private support subject",
      status: "open",
    },
    {
      id: id("spm"),
      caseId,
      authorId: owner.id,
      authorRole: "requester",
      body: "Private support context",
    },
    {
      id: id("aud"),
      actorId: owner.id,
      actorType: "user",
      action: "support.case.created",
      targetId: caseId,
      targetType: "support_case",
    },
  );
  return { owner, staff, other, supportCase };
}

/** Build an audit event payload for a support case mutation. */
export const audit = (
  caseId: string,
  actorId: string,
  action = "support.case.status_changed",
  auditId = id("aud"),
) => ({
  id: auditId,
  actorId,
  actorType: "user" as const,
  action,
  targetId: caseId,
  targetType: "support_case",
});

/** Issue a fresh initiating session token for a support mutation. */
export async function initiatingToken(userId: string) {
  const token = sessionUUID();
  await supportSessions.create({
    id: `ses_${sessionUUID()}`,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
}

export { cases, randomUUID };
