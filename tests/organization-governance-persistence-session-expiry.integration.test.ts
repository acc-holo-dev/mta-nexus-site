import { describe, expect, it } from "vitest";
import {
  auditEvents,
  db,
  deferred,
  digestSessionToken,
  eq,
  fixture,
  notifications,
  organizations,
  randomUUID,
  sessions,
  setupOrganizationGovernancePersistence,
  sql,
  transfer,
} from "./helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: session expiry", () => {
  it("rolls back ownership transfer when the initiating session expires during an audit wait", async () => {
    const f = await fixture(),
      auditId = `aud_late_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 4000);
    await db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.token, digestSessionToken(f.currentToken)));
    const ready = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx.insert(auditEvents).values({
        id: auditId,
        actorId: f.owner.id,
        actorType: "user",
        action: "fixture",
        targetId: f.org.id,
        targetType: "organization",
      });
      ready.resolve();
      await release.promise;
      throw new Error("rollback fixture");
    });
    try {
      await Promise.race([ready.promise, blocker]);
      const request = transfer(f, { auditId }).then(
        () => null,
        (error: unknown) => error,
      );
      let blocked = false;
      const deadline = Date.now() + 3000;
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
      release.resolve();
      await blocker.catch(() => {});
      expect(await request).toMatchObject({ code: "UNAUTHORIZED" });
      const [org] = await db.select().from(organizations).where(eq(organizations.id, f.org.id));
      expect(org.ownerId).toBe(f.owner.id);
      expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(
        0,
      );
      const notices = await db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientId, f.owner.id));
      expect(notices.some((row) => row.message.includes("ownership_transferred"))).toBe(false);
      const targetNotices = await db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientId, f.target.id));
      expect(targetNotices.some((row) => row.message.includes("ownership_gained"))).toBe(false);
    } finally {
      release.resolve();
      await blocker.catch(() => {});
    }
  }, 15000);
});
