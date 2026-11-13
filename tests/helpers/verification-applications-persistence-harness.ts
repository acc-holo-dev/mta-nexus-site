import { randomUUID } from "node:crypto";
import {
  auditEvents,
  db,
  developerProfileRepository,
  developerProfiles,
  notificationRepository,
  organizationMembers,
  organizationRepository,
  verificationWorkspaceRepository as repo,
  sessionRepository,
  userRepository,
  verificationRepository,
  verificationRequests,
} from "@nexus/db";
import { and, eq, sql } from "drizzle-orm";
import { digestSessionToken } from "../../site/packages/db/src/repositories/sessions";
import { sessions, users } from "../../site/packages/db/src/schema";

export {
  and,
  auditEvents,
  db,
  developerProfileRepository,
  developerProfiles,
  digestSessionToken,
  eq,
  notificationRepository,
  organizationMembers,
  organizationRepository,
  repo,
  sessions,
  sql,
  users,
  verificationRepository,
  verificationRequests,
};

/** Promise gate used by session lock-wait fixtures. */
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Wait until `pid` blocks another backend in the disposable database. */
export async function waitBlocked(pid: number) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(
      sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
    );
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Amendment did not reach the expected lock");
}

/** Create a disposable verification actor with a live initiating session. */
export async function user(role: "developer" | "moderator" = "developer") {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16),
    id = `usr_vapp_${suffix}`;
  await userRepository.create({
    id,
    email: `${suffix}@nexus.test`,
    username: `vapp_${suffix}`,
    displayName: "Evidence fixture",
    role,
  });
  await sessionRepository.create({
    id: `ses_${id}`,
    userId: id,
    token: `tok_${id}`,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  });
  return id;
}

/** Initiating staff session token for the seeded moderator. */
export async function staffSession(reviewerId: string) {
  return `tok_${reviewerId}`;
}

/** Upsert the actor's locked developer profile specialties. */
export async function profile(actorId: string, specialties = ["Lua"]) {
  const previous = await developerProfileRepository.own(actorId);
  return developerProfileRepository.update({
    actorId,
    currentToken: `tok_${actorId}`,
    expectedUpdatedAt: previous.updatedAt,
    specialties,
    githubUrl: "https://example.test",
    discordTag: "fixture",
    profileId: `dev_${randomUUID()}`,
    auditId: `aud_${randomUUID()}`,
  });
}

/** Seed a pending developer verification request for the actor. */
export async function request(actorId: string) {
  await profile(actorId);
  return verificationRepository.createRequest({
    requesterId: actorId,
    currentToken: `tok_${actorId}`,
    targetType: "developer",
    targetId: actorId,
    proofUrl: "https://example.test/old",
    notes: "Original evidence",
  });
}

/** Replace pending application evidence under the actor's initiating session. */
export async function amend(
  actorId: string,
  id: string,
  revision: string,
  auditId = `aud_${randomUUID()}`,
) {
  return repo.amend(
    actorId,
    id,
    {
      expectedRevision: revision,
      proofUrl: "https://example.test/new",
      notes: "Updated current evidence",
    },
    {
      id: auditId,
      actorId,
      actorType: "user",
      action: "verification.application_updated",
      targetId: id,
      targetType: "verification",
    },
    `tok_${actorId}`,
  );
}

/** Approved/rejected audit rows for a verification application. */
export const resolutionAudits = (id: string) =>
  db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.targetId, id),
        sql`${auditEvents.action} in ('verification.approved','verification.rejected')`,
      ),
    );
