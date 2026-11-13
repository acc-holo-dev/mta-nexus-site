import { createHash, randomUUID } from "node:crypto";
import {
  accountSubscriptions,
  auditEvents,
  db,
  sessionRepository,
  sessions,
  subscriptionReceipts,
  subscriptionsRepository as subscriptions,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  deferred,
  expectNoActivation,
  fixture,
  waitForLock,
} from "../helpers/subscriptions-persistence-harness";

describe("subscriptions persistence: session revocation and lock waits", () => {
  for (const state of ["revoked", "expired", "foreign", "missing"] as const) {
    it(`rejects a ${state} initiating session without creating a period, receipt or audit`, async () => {
      const f = await fixture();
      let token = f.actorToken;
      if (state === "revoked") await sessionRepository.delete(token);
      if (state === "expired")
        await db
          .update(sessions)
          .set({ expiresAt: new Date(0) })
          .where(eq(sessions.userId, f.actor));
      if (state === "foreign") token = f.currentToken;
      if (state === "missing") token = "";
      await expect(subscriptions.command(f.actor, f.command, token)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expectNoActivation(f);
    });
  }

  it("does not expose a retry receipt or cancel a period after the initiating session is revoked", async () => {
    const f = await fixture(),
      saved = await subscriptions.command(f.actor, f.command, f.actorToken);
    await sessionRepository.delete(f.actorToken);
    await expect(subscriptions.command(f.actor, f.command, f.actorToken)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      subscriptions.command(
        f.actor,
        {
          action: "cancel",
          requestId: randomUUID(),
          subscriptionId: saved.receipt.subscription.id,
        },
        f.actorToken,
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect((await subscriptions.dashboard(f.actor)).subscription?.status).toBe("active");
    expect(
      await db.select().from(subscriptionReceipts).where(eq(subscriptionReceipts.actorId, f.actor)),
    ).toHaveLength(1);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actor)),
    ).toHaveLength(1);
  });

  it("rejects revocation during the plan-row wait before activation writes", async () => {
    const f = await fixture(),
      locked = deferred(),
      release = deferred();
    const blocker = db.transaction(async (tx) => {
      await tx.execute(sql`select id from commercial_plans where id = ${f.planId} for update`);
      locked.resolve();
      await release.promise;
    });
    await Promise.race([locked.promise, blocker]);
    const pending = subscriptions.command(f.actor, f.command, f.actorToken).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForLock("commercial_plans");
      await sessionRepository.delete(f.actorToken);
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    await expectNoActivation(f);
  }, 15000);

  it("rejects revocation during a subscription-row wait without a cancellation receipt", async () => {
    const f = await fixture(),
      saved = await subscriptions.command(f.actor, f.command, f.actorToken),
      locked = deferred(),
      release = deferred();
    const blocker = db.transaction(async (tx) => {
      await tx
        .select({ id: accountSubscriptions.id })
        .from(accountSubscriptions)
        .where(eq(accountSubscriptions.id, saved.receipt.subscription.id))
        .for("update");
      locked.resolve();
      await release.promise;
    });
    await Promise.race([locked.promise, blocker]);
    const pending = subscriptions
      .command(
        f.actor,
        {
          action: "cancel",
          requestId: randomUUID(),
          subscriptionId: saved.receipt.subscription.id,
        },
        f.actorToken,
      )
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
    try {
      await waitForLock("account_subscriptions");
      await sessionRepository.delete(f.actorToken);
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect((await subscriptions.dashboard(f.actor)).subscription?.status).toBe("active");
    expect(
      await db.select().from(subscriptionReceipts).where(eq(subscriptionReceipts.actorId, f.actor)),
    ).toHaveLength(1);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actor)),
    ).toHaveLength(1);
  }, 15000);

  for (const action of ["activate", "cancel"] as const) {
    it(`rolls back ${action} when the initiating session expires during the audit write`, async () => {
      const f = await fixture();
      const activated =
        action === "cancel" ? await subscriptions.command(f.actor, f.command, f.actorToken) : null;
      const command = activated
        ? {
            action: "cancel" as const,
            requestId: randomUUID(),
            subscriptionId: activated.receipt.subscription.id,
          }
        : f.command;
      const key = createHash("sha256")
        .update(JSON.stringify({ actorId: f.actor, requestId: command.requestId.toLowerCase() }))
        .digest("hex");
      const expiresAt = Date.now() + 3000;
      await db
        .update(sessions)
        .set({ expiresAt: new Date(expiresAt) })
        .where(eq(sessions.userId, f.actor));
      const locked = deferred(),
        release = deferred();
      const blocker = db
        .transaction(async (tx) => {
          await tx.insert(auditEvents).values({
            id: `aud_sub_${key}`,
            actorId: f.actor,
            actorType: "user",
            action: "fixture.audit_collision",
            targetId: f.planId,
            targetType: "subscription",
            details: {},
          });
          locked.resolve();
          await release.promise;
          throw new Error("rollback fixture blocker");
        })
        .catch((error: unknown) => {
          if (!(error instanceof Error) || error.message !== "rollback fixture blocker")
            throw error;
        });
      await Promise.race([locked.promise, blocker]);
      const pending = subscriptions.command(f.actor, command, f.actorToken).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      try {
        const until = Date.now() + 4000;
        let waiting = false;
        while (Date.now() < until) {
          const result = await db.execute<{ waiting: boolean }>(sql`select exists (
          select 1 from pg_stat_activity where datname = current_database()
            and pid <> pg_backend_pid() and wait_event_type = 'Lock'
            and query like '%insert into "audit_events"%'
        ) as waiting`);
          if (result[0]?.waiting) {
            waiting = true;
            break;
          }
          await new Promise((done) => setTimeout(done, 10));
        }
        expect(waiting).toBe(true);
        await new Promise((done) => setTimeout(done, Math.max(0, expiresAt - Date.now() + 100)));
      } finally {
        release.resolve();
        await blocker;
      }
      expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
      const periods = await db
        .select()
        .from(accountSubscriptions)
        .where(eq(accountSubscriptions.actorId, f.actor));
      expect(periods).toHaveLength(activated ? 1 : 0);
      if (activated) expect(periods[0]?.status).toBe("active");
      expect(
        await db
          .select()
          .from(subscriptionReceipts)
          .where(eq(subscriptionReceipts.actorId, f.actor)),
      ).toHaveLength(activated ? 1 : 0);
      expect(
        await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actor)),
      ).toHaveLength(activated ? 1 : 0);
    }, 15000);
  }
});
