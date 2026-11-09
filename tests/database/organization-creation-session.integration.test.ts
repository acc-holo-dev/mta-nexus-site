import { randomUUID } from "node:crypto";
import {
  db,
  organizationWorkspaceRepository as repository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { auditEvents, organizations, users } from "../../packages/db/src/schema";

it("rolls back organization and membership if the initiating session expires during an audit wait", async () => {
  const key = randomUUID().replaceAll("-", "");
  const actorId = `usr_org_race_${key}`,
    organizationId = `org_race_${key}`,
    auditId = `aud_race_${key}`,
    token = `tok_${key}`;
  await userRepository.create({
    id: actorId,
    username: actorId,
    email: `${key}@example.invalid`,
    displayName: "Owner",
  });
  const expiresAt = new Date(Date.now() + 4000);
  await sessionRepository.create({ id: `ses_${key}`, userId: actorId, token, expiresAt });
  let release!: () => void,
    locked!: () => void,
    pid = 0;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx.insert(auditEvents).values({
      id: auditId,
      actorId,
      actorType: "user",
      action: "fixture",
      targetType: "organization",
      targetId: organizationId,
    });
    locked();
    await released;
    throw new Error("rollback fixture");
  });
  try {
    await Promise.race([ready, blocker]);
    const result = repository
      .create(
        organizationId,
        actorId,
        `org-${key}`,
        { name: "Organization", description: "", logoUrl: "", websiteUrl: "" },
        {
          id: auditId,
          actorId,
          actorType: "user",
          action: "organization.created",
          targetType: "organization",
          targetId: organizationId,
          details: { creationNonce: key },
        },
        token,
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    const deadline = Date.now() + 3000;
    let blocked = false;
    while (Date.now() < deadline) {
      const [row] = await db.execute<{ blocked: boolean }>(
        sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
      );
      if (row?.blocked) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(blocked).toBe(true);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 150)),
    );
    release();
    await blocker.catch(() => {});
    expect(await result).toMatchObject({ code: "UNAUTHORIZED" });
    expect(
      await db.select().from(organizations).where(eq(organizations.id, organizationId)),
    ).toHaveLength(0);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(0);
  } finally {
    release();
    await blocker.catch(() => {});
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(users).where(eq(users.id, actorId));
  }
}, 15000);

it("recovers a created organization only for its live owner session", async () => {
  const key = randomUUID().replaceAll("-", ""),
    actorId = `usr_org_rec_${key}`,
    organizationId = `org_rec_${key}`,
    token = `tok_${key}`;
  await userRepository.create({
    id: actorId,
    username: actorId,
    email: `${key}@example.invalid`,
    displayName: "Owner",
  });
  await sessionRepository.create({
    id: `ses_${key}`,
    userId: actorId,
    token,
    expiresAt: new Date(Date.now() + 60000),
  });
  try {
    await repository.create(
      organizationId,
      actorId,
      `org-${key}`,
      { name: "Organization", description: "", logoUrl: "", websiteUrl: "" },
      {
        id: `aud_${key}`,
        actorId,
        actorType: "user",
        action: "organization.created",
        targetType: "organization",
        targetId: organizationId,
        details: { creationNonce: key },
      },
      token,
    );
    expect(await repository.findCreatedForRecovery(actorId, key, token)).toEqual({
      id: organizationId,
    });
    expect(await repository.findCreatedForRecovery(actorId, key, "wrong-token")).toBeNull();
    await sessionRepository.delete(token);
    expect(await repository.findCreatedForRecovery(actorId, key, token)).toBeNull();
  } finally {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(users).where(eq(users.id, actorId));
  }
});
