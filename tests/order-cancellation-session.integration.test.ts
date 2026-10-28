import { randomUUID } from "node:crypto";
import {
  auditEvents,
  db,
  orderCancellationReceipts,
  orderOperationsRepository,
  orders,
  sessionRepository,
  sessions,
  userRepository,
} from "@nexus/db";
import { count, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";

async function fixture() {
  const key = randomUUID().replaceAll("-", "");
  const buyerId = `usr_order_session_${key}`;
  const currentToken = `order-token-${key}`;
  const sessionId = `ses_order_${key}`;
  const orderId = `ord_session_${key}`;
  await userRepository.create({
    id: buyerId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Order session fixture",
  });
  await sessionRepository.create({
    id: sessionId,
    userId: buyerId,
    token: currentToken,
    expiresAt: new Date(Date.now() + 3600000),
  });
  const [order] = await db
    .insert(orders)
    .values({
      id: orderId,
      orderNumber: `session-${key}`,
      buyerId,
      status: "pending",
      totalAmount: 999,
      currency: "USD",
    })
    .returning({ updatedAt: orders.updatedAt });
  if (!order) throw new Error("Missing fixture order");
  return {
    sessionId,
    input: {
      buyerId,
      currentToken,
      orderId,
      auditId: `aud_order_session_${key}`,
      command: {
        requestId: randomUUID(),
        expectedUpdatedAt: order.updatedAt.toISOString(),
        reason: "Session fixture cancellation",
      },
    },
  };
}

async function state(f: Awaited<ReturnType<typeof fixture>>) {
  const [order] = await db
    .select({ status: orders.status, updatedAt: orders.updatedAt })
    .from(orders)
    .where(eq(orders.id, f.input.orderId));
  const [receipts] = await db
    .select({ total: count() })
    .from(orderCancellationReceipts)
    .where(eq(orderCancellationReceipts.orderId, f.input.orderId));
  const [audits] = await db
    .select({ total: count() })
    .from(auditEvents)
    .where(eq(auditEvents.targetId, f.input.orderId));
  return { order, receipts: receipts?.total, audits: audits?.total };
}

for (const invalid of ["revoked", "expired", "foreign", "missing"] as const) {
  it(`does not cancel or create a receipt/audit with a ${invalid} initiating session`, async () => {
    const f = await fixture();
    const before = await state(f);
    let token = f.input.currentToken;
    if (invalid === "revoked") await sessionRepository.delete(token);
    if (invalid === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (invalid === "foreign") token = (await fixture()).input.currentToken;
    if (invalid === "missing") token = "";
    await expect(
      orderOperationsRepository.cancel({ ...f.input, currentToken: token }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await state(f)).toEqual(before);
    expect(before).toMatchObject({ order: { status: "pending" }, receipts: 0, audits: 0 });
  });
}

it("requires a live session to replay a stored cancellation and preserves the original receipt", async () => {
  const f = await fixture();
  const result = await orderOperationsRepository.cancel(f.input);
  const before = await state(f);
  expect(await orderOperationsRepository.cancel(f.input)).toEqual(result);
  await sessionRepository.delete(f.input.currentToken);
  await expect(orderOperationsRepository.cancel(f.input)).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(await state(f)).toEqual(before);
  expect(before).toMatchObject({ order: { status: "cancelled" }, receipts: 1, audits: 1 });
});

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("rejects a session revoked while cancellation is waiting on the order row", async () => {
  const f = await fixture();
  const before = await state(f);
  const locked = deferred(),
    release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, f.input.orderId))
      .for("update");
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = orderOperationsRepository.cancel(f.input).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await expect
      .poll(
        async () => {
          const result = await db.execute<{ waiting: boolean }>(sql`select exists (
            select 1 from pg_stat_activity
            where datname = current_database() and pid <> pg_backend_pid()
              and wait_event_type = 'Lock' and query like '%"orders"%for no key update%'
          ) as waiting`);
          return result[0]?.waiting === true;
        },
        { timeout: 10000, interval: 10 },
      )
      .toBe(true);
    await sessionRepository.delete(f.input.currentToken);
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect(await state(f)).toEqual(before);
}, 20000);
