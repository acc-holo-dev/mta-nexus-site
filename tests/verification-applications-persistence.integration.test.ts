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
import { expect, it } from "vitest";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import { sessions, users } from "../packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitBlocked(pid: number) {
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

async function user(role: "developer" | "moderator" = "developer") {
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
async function staffSession(reviewerId: string) {
  return `tok_${reviewerId}`;
}
async function profile(actorId: string, specialties = ["Lua"]) {
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
async function request(actorId: string) {
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
async function amend(
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
const resolutionAudits = (id: string) =>
  db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.targetId, id),
        sql`${auditEvents.action} in ('verification.approved','verification.rejected')`,
      ),
    );
it("rebinds changed professional evidence to a current locked profile before independent approval, without changing original submission time or commercial scores", async () => {
  const actorId = await user(),
    reviewerId = await user("moderator"),
    token = await staffSession(reviewerId),
    application = await request(actorId),
    before = await repo.application(actorId, application.id);
  await profile(actorId, ["TypeScript"]);
  expect((await repo.application(actorId, application.id)).profileState).toBe("changed");
  const saved = await amend(actorId, application.id, before.revision),
    after = await repo.application(actorId, application.id);
  expect(after).toMatchObject({ revision: saved.revision, profileState: "current" });
  expect(after.row.createdAt).toBe(before.row.createdAt);
  expect(after.row.status).toBe("pending");
  expect((await developerProfileRepository.own(actorId)).verifiedDeveloper).toBe(false);
  await verificationRepository.resolveRequest({
    id: application.id,
    reviewerId,
    decision: "approved",
    currentToken: token,
    expectedApplicationRevision: saved.revision,
  });
  expect((await developerProfileRepository.own(actorId)).verifiedDeveloper).toBe(true);
  const [stored] = await db
    .select()
    .from(developerProfiles)
    .where(eq(developerProfiles.userId, actorId));
  expect(stored.reputationScore).toBe(100);
  expect(stored.completedDealsCount).toBe(0);
  expect(
    await notificationRepository.findById(`ntf_verification_resolution_${application.id}`),
  ).toMatchObject({ recipientId: actorId });
});
it("rolls back stale and legacy unbound decisions after amendments, then accepts a fresh independent rejection", async () => {
  const actorId = await user(),
    reviewerId = await user("moderator"),
    token = await staffSession(reviewerId),
    application = await request(actorId),
    before = await repo.application(actorId, application.id),
    saved = await amend(actorId, application.id, before.revision);
  for (const decision of ["approved", "rejected"] as const)
    for (const expectedApplicationRevision of [undefined, before.revision])
      await expect(
        verificationRepository.resolveRequest({
          id: application.id,
          reviewerId,
          decision,
          currentToken: token,
          expectedApplicationRevision,
        }),
      ).rejects.toMatchObject({ code: "VERIFICATION_APPLICATION_CHANGED" });
  expect(await verificationRepository.findById(application.id)).toMatchObject({
    status: "pending",
    reviewerId: null,
    resolvedAt: null,
  });
  expect(await resolutionAudits(application.id)).toHaveLength(0);
  expect(
    await notificationRepository.findById(`ntf_verification_resolution_${application.id}`),
  ).toBeNull();
  await verificationRepository.resolveRequest({
    id: application.id,
    reviewerId,
    decision: "rejected",
    currentToken: token,
    expectedApplicationRevision: saved.revision,
  });
  expect(await verificationRepository.findById(application.id)).toMatchObject({
    status: "rejected",
  });
  await expect(amend(actorId, application.id, saved.revision)).rejects.toMatchObject({
    code: "VERIFICATION_APPLICATION_CHANGED",
  });
});
it("serializes two replacements of the same evidence version and a replacement racing with a moderator decision", async () => {
  const actorId = await user(),
    reviewerId = await user("moderator"),
    token = await staffSession(reviewerId),
    application = await request(actorId),
    before = await repo.application(actorId, application.id);
  const replacements = await Promise.allSettled([
    amend(actorId, application.id, before.revision),
    amend(actorId, application.id, before.revision),
  ]);
  expect(replacements.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(replacements.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "VERIFICATION_APPLICATION_CHANGED" },
  });
  const current = await repo.application(actorId, application.id),
    race = await Promise.allSettled([
      amend(actorId, application.id, current.revision),
      verificationRepository.resolveRequest({
        id: application.id,
        reviewerId,
        decision: "rejected",
        currentToken: token,
        expectedApplicationRevision: current.revision,
      }),
    ]);
  expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(race.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "VERIFICATION_APPLICATION_CHANGED" },
  });
});
it("rolls back evidence and revision on mandatory audit failure", async () => {
  const actorId = await user(),
    application = await request(actorId),
    before = await repo.application(actorId, application.id);
  await expect(
    amend(actorId, application.id, before.revision, before.events[0].id),
  ).rejects.toThrow();
  const after = await repo.application(actorId, application.id);
  expect(after.revision).toBe(before.revision);
  expect(after.row.proofUrl).toBe(before.row.proofUrl);
  expect(after.row.notes).toBe(before.row.notes);
  expect(after.events).toEqual(before.events);
});
it("denies foreign access and rechecks revoked organization administration before replacing evidence", async () => {
  const actorId = await user(),
    ownerId = await user(),
    organizationId = `org_${randomUUID()}`;
  await organizationRepository.create({
    id: organizationId,
    name: "Evidence team",
    slug: `evidence-${randomUUID()}`,
    ownerId,
  });
  await db
    .insert(organizationMembers)
    .values({ id: `member_${randomUUID()}`, organizationId, userId: actorId, role: "admin" });
  const application = await verificationRepository.createRequest({
      requesterId: actorId,
      currentToken: `tok_${actorId}`,
      targetType: "organization",
      targetId: organizationId,
      notes: "Original evidence",
    }),
    before = await repo.application(actorId, application.id);
  await expect(repo.application(ownerId, application.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(amend(ownerId, application.id, before.revision)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await db
    .update(organizationMembers)
    .set({ role: "member" })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, actorId),
      ),
    );
  await expect(amend(actorId, application.id, before.revision)).rejects.toMatchObject({
    code: "VERIFICATION_AUTHORITY_CHANGED",
  });
  expect((await repo.application(actorId, application.id)).revision).toBe(before.revision);
});
it("traverses equal-microsecond own history in both directions without a removed-anchor lookup or account/filter reuse", async () => {
  const actorId = await user(),
    foreign = await user(),
    prefix = `history_${randomUUID().replaceAll("-", "")}`,
    createdAt = sql`'2026-10-11T00:00:00.123456Z'::timestamptz`;
  await db.insert(verificationRequests).values(
    Array.from({ length: 45 }, (_, n) => ({
      id: `${prefix}_${String(n).padStart(3, "0")}`,
      requesterId: actorId,
      targetType: "user",
      targetId: actorId,
      status: "rejected",
      notes: prefix,
      createdAt,
    })),
  );
  const filters = { query: prefix, status: "rejected", type: "user" },
    first = await repo.applications(actorId, filters),
    second = await repo.applications(actorId, {
      ...filters,
      cursor: JSON.parse(first.olderCursor ?? ""),
    }),
    third = await repo.applications(actorId, {
      ...filters,
      cursor: JSON.parse(second.olderCursor ?? ""),
    });
  expect([first.items.length, second.items.length, third.items.length]).toEqual([20, 20, 5]);
  expect(
    new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size,
  ).toBe(45);
  expect(first.items[0].createdAt).toBe("2026-10-11T00:00:00.123456Z");
  const back = await repo.applications(actorId, {
    ...filters,
    cursor: JSON.parse(third.newerCursor ?? ""),
  });
  expect(back.items.map((item) => item.id)).toEqual(second.items.map((item) => item.id));
  const anchor = JSON.parse(first.olderCursor ?? "");
  await db.delete(verificationRequests).where(eq(verificationRequests.id, anchor.id));
  expect(
    (await repo.applications(actorId, { ...filters, cursor: anchor })).items.map((item) => item.id),
  ).toEqual(second.items.map((item) => item.id));
  await expect(repo.applications(foreign, { ...filters, cursor: anchor })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  await expect(
    repo.applications(actorId, { ...filters, status: "all", cursor: anchor }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
it("rejects amendment after session revocation while waiting on the application", async () => {
  const actorId = await user(),
    application = await request(actorId),
    previous = await repo.application(actorId, application.id);
  const ready = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx
      .select({ id: verificationRequests.id })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, application.id))
      .for("update");
    ready.resolve();
    await release.promise;
    await tx.delete(sessions).where(eq(sessions.token, digestSessionToken(`tok_${actorId}`)));
  });
  try {
    await Promise.race([ready.promise, blocker]);
    const pending = amend(actorId, application.id, previous.revision).then(
      () => null,
      (error: unknown) => error,
    );
    await waitBlocked(pid);
    release.resolve();
    await blocker;
    expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
    const [stored] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, application.id));
    expect(stored.proofUrl).toBe("https://example.test/old");
    expect(
      (await db.select().from(auditEvents).where(eq(auditEvents.targetId, application.id))).filter(
        (a) => a.action === "verification.application_updated",
      ),
    ).toHaveLength(0);
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await db.delete(verificationRequests).where(eq(verificationRequests.id, application.id));
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(users).where(eq(users.id, actorId));
  }
}, 15000);
it("rolls back amendment if the initiating session expires during an audit wait", async () => {
  const actorId = await user(),
    application = await request(actorId),
    previous = await repo.application(actorId, application.id),
    auditId = `aud_wait_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 4000);
  await db
    .update(sessions)
    .set({ expiresAt })
    .where(eq(sessions.token, digestSessionToken(`tok_${actorId}`)));
  const ready = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx.insert(auditEvents).values({
      id: auditId,
      actorId,
      actorType: "user",
      action: "fixture",
      targetType: "verification",
      targetId: application.id,
    });
    ready.resolve();
    await release.promise;
    throw new Error("rollback fixture");
  });
  try {
    await Promise.race([ready.promise, blocker]);
    const pending = amend(actorId, application.id, previous.revision, auditId).then(
      () => null,
      (error: unknown) => error,
    );
    await waitBlocked(pid);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 150)),
    );
    release.resolve();
    await blocker.catch(() => {});
    expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
    const [stored] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, application.id));
    expect(stored.proofUrl).toBe("https://example.test/old");
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(0);
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await db.delete(verificationRequests).where(eq(verificationRequests.id, application.id));
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(users).where(eq(users.id, actorId));
  }
}, 15000);
