import { randomUUID } from "node:crypto";
import {
  auditEvents,
  db,
  organizationGovernanceRepository as governance,
  notifications,
  organizationMembers,
  organizations,
  sessionRepository,
  sessions,
  userRepository,
} from "@nexus/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { expect, it } from "vitest";

async function identity() {
  const key = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_org_session_${key}`,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Organization session fixture",
  });
  const currentToken = `org-transfer-token-${key}`;
  const sessionId = `ses_org_${key}`;
  await sessionRepository.create({
    id: sessionId,
    userId: user.id,
    token: currentToken,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return { user, currentToken, sessionId };
}

async function fixture() {
  const owner = await identity(),
    target = await identity(),
    key = randomUUID().replaceAll("-", "");
  const [organization] = await db
    .insert(organizations)
    .values({
      id: `org_session_${key}`,
      ownerId: owner.user.id,
      name: "Transfer session fixture",
      slug: `session-${key}`,
      isVerified: true,
    })
    .returning();
  await db.insert(organizationMembers).values([
    {
      id: `mem_owner_${key}`,
      organizationId: organization.id,
      userId: owner.user.id,
      role: "owner",
      permissions: ["manage_servers", "custom_owner_grant"],
    },
    {
      id: `mem_target_${key}`,
      organizationId: organization.id,
      userId: target.user.id,
      role: "developer",
      permissions: ["manage_products", "custom_target_grant"],
    },
  ]);
  return {
    sessionId: owner.sessionId,
    input: {
      id: organization.id,
      actorId: owner.user.id,
      currentToken: owner.currentToken,
      targetId: target.user.id,
      targetUsername: target.user.username,
      confirmationSlug: organization.slug,
      expectedUpdatedAt: organization.updatedAt,
      formerOwnerRole: "admin" as const,
      memberId: `mem_new_${key}`,
      auditId: `aud_org_transfer_${key}`,
    },
  };
}

async function state(f: Awaited<ReturnType<typeof fixture>>) {
  const organization = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, f.input.id));
  const memberships = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, f.input.id))
    .orderBy(asc(organizationMembers.id));
  const audit = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.targetId, f.input.id))
    .orderBy(asc(auditEvents.id));
  const notices = await db
    .select()
    .from(notifications)
    .where(inArray(notifications.recipientId, [f.input.actorId, f.input.targetId]))
    .orderBy(asc(notifications.id));
  return { organization, memberships, audit, notices };
}

for (const invalid of ["missing", "revoked", "expired", "foreign"] as const) {
  it(`preserves ownership, memberships, audit and notices with a ${invalid} initiating session`, async () => {
    const f = await fixture();
    const before = await state(f);
    let currentToken = f.input.currentToken;
    if (invalid === "missing") currentToken = "";
    if (invalid === "revoked") await sessionRepository.delete(currentToken);
    if (invalid === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (invalid === "foreign") currentToken = (await identity()).currentToken;
    await expect(governance.transfer({ ...f.input, currentToken })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(await state(f)).toEqual(before);
  });
}

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitForDatabaseLock(table: "organizations" | "organization_members" | "sessions") {
  await expect
    .poll(
      async () => {
        const result = await db.execute<{ waiting: boolean }>(sql`select exists (
          select 1 from pg_stat_activity
          where datname = current_database() and pid <> pg_backend_pid()
            and wait_event_type = 'Lock' and query like ${`%"${table}"%for update%`}
        ) as waiting`);
        return result[0]?.waiting === true;
      },
      { timeout: 10000, interval: 10 },
    )
    .toBe(true);
}

for (const table of ["organizations", "organization_members"] as const) {
  it(`rejects revocation while transfer waits on ${table} and rolls back every transfer record`, async () => {
    const f = await fixture();
    const before = await state(f);
    const locked = deferred(),
      release = deferred();
    const blocker = db.transaction(async (tx) => {
      if (table === "organizations")
        await tx
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.id, f.input.id))
          .for("update");
      else
        await tx
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(eq(organizationMembers.userId, f.input.targetId))
          .for("update");
      locked.resolve();
      await release.promise;
    });
    await Promise.race([locked.promise, blocker]);
    const pending = governance.transfer(f.input).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForDatabaseLock(table);
      await sessionRepository.delete(f.input.currentToken);
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await state(f)).toEqual(before);
  }, 20000);
}

it("rejects expiry during the session-row wait after its SELECT began while valid", async () => {
  const f = await fixture();
  const before = await state(f);
  const expiresAt = new Date(Date.now() + 3000);
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
  const locked = deferred(),
    release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, f.sessionId))
      .for("update");
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = governance.transfer(f.input).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForDatabaseLock("sessions");
    await expect
      .poll(() => Date.now() >= expiresAt.getTime(), { timeout: 10000, interval: 10 })
      .toBe(true);
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect(await state(f)).toEqual(before);
}, 20000);
