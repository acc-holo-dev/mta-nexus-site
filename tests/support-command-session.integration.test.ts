import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  auditEvents,
  supportCaseRepository as cases,
  db,
  notifications,
  sessionRepository,
  sessions,
  supportCaseMessages,
  supportCases,
  supportMutationRequests,
  userRepository,
  users,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";

const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
async function actor(role: "user" | "moderator" = "user") {
  const userId = id("usr_support_session");
  const token = id("token");
  const sessionId = id("ses");
  await userRepository.create({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "Support session fixture",
    role,
  });
  for (const [sid, raw] of [
    [sessionId, token],
    [id("ses_other"), id("other_token")],
  ] as const)
    await sessionRepository.create({
      id: sid,
      userId,
      token: raw,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
  return { userId, token, sessionId };
}
function audit(caseId: string, actorId: string, action = "support.message.created") {
  return {
    id: id("aud"),
    actorId,
    actorType: "user" as const,
    action,
    targetId: caseId,
    targetType: "support_case",
  };
}
async function fixture() {
  const owner = await actor();
  const staff = await actor("moderator");
  const caseId = id("sup");
  const supportCase = await cases.createWithInitialMessage(
    {
      id: caseId,
      requesterId: owner.userId,
      category: "account",
      subject: "Private fixture",
      status: "open",
    },
    {
      id: id("spm"),
      caseId,
      authorId: owner.userId,
      authorRole: "requester",
      body: "Private context",
    },
    audit(caseId, owner.userId, "support.case.created"),
  );
  const message = {
    id: id("spm"),
    caseId,
    authorId: owner.userId,
    authorRole: "requester" as const,
    body: "One durable reply",
    expectedStatus: "open" as const,
  };
  const request = {
    actorId: owner.userId,
    requestKey: randomUUID(),
    operation: "reply" as const,
    fingerprint: "a".repeat(64),
    caseId,
    messageId: message.id,
  };
  return { owner, staff, caseId, supportCase, message, request };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function snapshot(f: Fixture) {
  return {
    cases: await db.select().from(supportCases).where(eq(supportCases.requesterId, f.owner.userId)),
    messages: await db
      .select()
      .from(supportCaseMessages)
      .where(eq(supportCaseMessages.caseId, f.caseId)),
    requests: await db
      .select()
      .from(supportMutationRequests)
      .where(eq(supportMutationRequests.actorId, f.owner.userId)),
    audits: await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.caseId)),
    notices: await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, f.owner.userId)),
  };
}
function create(f: Fixture, token: string, requestKey = randomUUID()) {
  const caseId = id("sup"),
    messageId = id("spm");
  return cases.createIdempotentCase(
    {
      id: caseId,
      requesterId: f.owner.userId,
      category: "account",
      subject: "New case",
      status: "open",
    },
    {
      id: messageId,
      caseId,
      authorId: f.owner.userId,
      authorRole: "requester",
      body: "New case context",
    },
    audit(caseId, f.owner.userId, "support.case.created"),
    { ...f.request, requestKey, operation: "case", caseId, messageId },
    token,
  );
}
function reply(f: Fixture, token: string) {
  return cases.addIdempotentMessage(f.message, audit(f.caseId, f.owner.userId), f.request, token);
}
function status(f: Fixture, who = f.owner, next: "open" | "closed" | "resolved" = "resolved") {
  return cases.updateStatus(
    f.caseId,
    next,
    audit(f.caseId, who.userId, "support.case.status_changed"),
    "open",
    who.token,
    f.supportCase.updatedAt,
  );
}
for (const invalid of ["revoked", "expired", "foreign", "missing"] as const) {
  it(`rejects SUPPORT create, reply, status, no-op and replay with a ${invalid} initiator despite another live session`, async () => {
    const f = await fixture();
    expect((await reply(f, f.owner.token)).kind).toBe("created");
    const committed = await cases.findById(f.caseId);
    if (!committed) throw new Error("Missing committed case");
    f.supportCase = committed;
    let token = f.owner.token;
    if (invalid === "revoked") await sessionRepository.delete(token);
    if (invalid === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.owner.sessionId));
    if (invalid === "foreign") token = f.staff.token;
    if (invalid === "missing") token = "";
    const freshMessageId = id("spm");
    const before = await snapshot(f);
    for (const command of [
      () => create(f, token),
      () => reply(f, token),
      () =>
        cases.addIdempotentMessage(
          { ...f.message, id: freshMessageId },
          audit(f.caseId, f.owner.userId),
          { ...f.request, requestKey: randomUUID(), messageId: freshMessageId },
          token,
        ),
      () => status(f, { ...f.owner, token }),
      () => status(f, { ...f.owner, token }, "open"),
      () => cases.findMutationReplay(f.request, token),
      () => cases.findMutationReplay({ ...f.request, requestKey: randomUUID() }, token),
      () => cases.findMutationReplay({ ...f.request, fingerprint: "b".repeat(64) }, token),
    ]) {
      await expect(command()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    expect(await snapshot(f)).toEqual(before);
    expect(JSON.stringify(before)).not.toContain(f.owner.token);
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function outcome<T>(promise: Promise<T>) {
  try {
    return { ok: true as const, value: await promise };
  } catch (error) {
    return { ok: false as const, error };
  }
}
async function afterWait<T>(
  lock: (tx: Tx) => Promise<unknown>,
  command: () => Promise<T>,
  invalidate: (tx: Tx) => Promise<unknown>,
  rollback = false,
) {
  const rollbackReservation = new Error("Roll back the held reservation");
  let pending: ReturnType<typeof outcome<T>> | undefined;
  let completed = false;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '3s'`);
      await lock(tx);
      const [row] = await tx.execute(sql`select pg_backend_pid() as pid`);
      pending = outcome(command()).then((result) => {
        completed = true;
        return result;
      });
      const deadline = Date.now() + 3_000;
      while (true) {
        expect(completed, "SUPPORT command must wait for the held row").toBe(false);
        const [wait] = await db.execute(sql`select exists (
          select 1 from pg_stat_activity where ${Number(row.pid)}::integer = any(pg_blocking_pids(pid))
        ) as waiting`);
        if (wait.waiting === true) break;
        if (Date.now() >= deadline) throw new Error("SUPPORT row lock wait was not observed");
        await delay(10);
      }
      await invalidate(tx);
      if (rollback) throw rollbackReservation;
    });
  } catch (error) {
    if (error !== rollbackReservation) throw error;
  } finally {
    if (pending) await pending;
  }
  if (!pending) throw new Error("SUPPORT command did not start");
  const result = await pending;
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("SUPPORT command unexpectedly succeeded");
  return result.error;
}
it("locks the case before the initiating session and rejects a token revoked during that wait", async () => {
  const f = await fixture();
  const before = await snapshot(f);
  const error = await afterWait(
    (tx) => tx.select().from(supportCases).where(eq(supportCases.id, f.caseId)).for("update"),
    () => reply(f, f.owner.token),
    (tx) => tx.delete(sessions).where(eq(sessions.id, f.owner.sessionId)),
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(await snapshot(f)).toEqual(before);
});
it("rechecks current staff authority after the actor row wait, including replay access", async () => {
  const f = await fixture();
  const staffRequest = { ...f.request, actorId: f.staff.userId };
  expect(
    (
      await cases.addIdempotentMessage(
        { ...f.message, authorId: f.staff.userId, authorRole: "staff" },
        audit(f.caseId, f.staff.userId),
        staffRequest,
        f.staff.token,
      )
    ).kind,
  ).toBe("created");
  const before = await snapshot(f);
  const error = await afterWait(
    (tx) => tx.select().from(users).where(eq(users.id, f.staff.userId)).for("update"),
    () => status(f, f.staff, "closed"),
    (tx) => tx.update(users).set({ role: "user" }).where(eq(users.id, f.staff.userId)),
  );
  expect(error).toMatchObject({ code: "NOT_FOUND" });
  expect(await snapshot(f)).toEqual(before);
  await expect(cases.findMutationReplay(staffRequest, f.staff.token)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("checks wall-clock expiry after waiting for the initiating session row", async () => {
  const f = await fixture();
  const expiresAt = new Date(Date.now() + 1_200);
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.owner.sessionId));
  const before = await snapshot(f);
  const error = await afterWait(
    (tx) => tx.select().from(sessions).where(eq(sessions.id, f.owner.sessionId)).for("update"),
    () => create(f, f.owner.token),
    async () => {
      await delay(Math.max(0, expiresAt.getTime() - Date.now() + 20));
    },
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(await snapshot(f)).toEqual(before);
});

it("rejects a create that expires while a conflicting reservation rolls back", async () => {
  const f = await fixture();
  const expiresAt = new Date(Date.now() + 1_200);
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.owner.sessionId));
  const before = await snapshot(f);
  const error = await afterWait(
    (tx) => tx.insert(supportMutationRequests).values({ ...f.request, operation: "case" }),
    () => create(f, f.owner.token, f.request.requestKey),
    async () => {
      await delay(Math.max(0, expiresAt.getTime() - Date.now() + 20));
    },
    true,
  );
  expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  expect(await snapshot(f)).toEqual(before);
});
