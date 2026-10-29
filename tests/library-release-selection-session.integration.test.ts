import { createHash, randomUUID } from "node:crypto";
import {
  auditEvents,
  builds,
  db,
  entitlements,
  licenses,
  products,
  resourceLibrarySelections,
  resourceLibrarySelectionsRepository as selections,
  sessionRepository,
  sessions,
  userRepository,
  users,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import type { ResourceTransaction } from "../packages/db/src/transaction";

async function identity() {
  const key = randomUUID().replaceAll("-", ""),
    userId = `usr_single_${key}`,
    token = `single-token-${key}`,
    sessionId = `ses_single_${key}`;
  await userRepository.create({
    id: userId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Selection session",
    role: "user",
  });
  await sessionRepository.create({
    id: sessionId,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { key, userId, token, sessionId };
}
async function fixture(access: "entitlement" | "license" = "entitlement") {
  const f = await identity(),
    productId = `prd_single_${f.key}`,
    buildId = `bld_single_${f.key}`,
    accessId = `access_single_${f.key}`;
  await db.insert(products).values({
    id: productId,
    authorId: f.userId,
    title: "Selection session",
    slug: productId,
    description: "Selection session",
    type: "script",
    status: "published",
  });
  await db.insert(builds).values({
    id: buildId,
    productId,
    version: "1.0.0",
    status: "published",
    scanStatus: "clean",
    scanner: "integration-test",
    scannedAt: new Date(),
    storageKey: `fixture/${f.key}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
  });
  if (access === "entitlement")
    await db.insert(entitlements).values({
      id: accessId,
      subjectType: "user",
      subjectId: f.userId,
      resourceId: productId,
      permission: "product.download",
    });
  else
    await db.insert(licenses).values({
      id: accessId,
      key: `private-${f.key}`,
      userId: f.userId,
      productId,
      model: "unlimited",
      status: "active",
    });
  return {
    ...f,
    productId,
    buildId,
    accessId,
    input: {
      userId: f.userId,
      currentToken: f.token,
      productId,
      command: {
        mode: "fixed" as const,
        expectedRevision: 0,
        buildId,
        reviewedArtifact: { sha256Hash: "a".repeat(64), fileSizeBytes: 7 },
      },
      auditId: `aud_single_${f.key}`,
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function state(f: Fixture) {
  return {
    selections: await db
      .select()
      .from(resourceLibrarySelections)
      .where(eq(resourceLibrarySelections.userId, f.userId)),
    audits: await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.userId)),
  };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
type Target = "advisory" | "product" | "actor" | "grant" | "selection" | "build" | "session";
async function lock(tx: ResourceTransaction, f: Fixture, target: Target) {
  if (target === "advisory")
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`library-selection:${f.userId}:${f.productId}`}))`,
    );
  else if (target === "product")
    await tx.select().from(products).where(eq(products.id, f.productId)).for("update");
  else if (target === "actor")
    await tx.select().from(users).where(eq(users.id, f.userId)).for("update");
  else if (target === "grant")
    await tx.select().from(entitlements).where(eq(entitlements.id, f.accessId)).for("update");
  else if (target === "selection")
    await tx
      .select()
      .from(resourceLibrarySelections)
      .where(eq(resourceLibrarySelections.userId, f.userId))
      .for("update");
  else if (target === "build")
    await tx.select().from(builds).where(eq(builds.id, f.buildId)).for("update");
  else await tx.select().from(sessions).where(eq(sessions.id, f.sessionId)).for("update");
}
async function duringWait(
  f: Fixture,
  target: Target,
  action: () => Promise<unknown>,
  commit?: (tx: ResourceTransaction) => Promise<unknown>,
) {
  const locked = deferred<number>(),
    release = deferred<void>();
  const blocker = db.transaction(async (tx) => {
    await lock(tx, f, target);
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    locked.resolve(row.pid);
    await release.promise;
    await commit?.(tx);
  });
  const pid = await Promise.race([
    locked.promise,
    blocker.then(() => {
      throw new Error("Blocker exited before locking");
    }),
  ]);
  const pending = selections.command(f.input).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await expect
      .poll(
        async () => {
          const [row] = await db.execute<{ waiting: boolean }>(
            sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid)) and wait_event_type='Lock') as waiting`,
          );
          return row.waiting;
        },
        { timeout: 10000, interval: 10 },
      )
      .toBe(true);
    await action();
  } finally {
    release.resolve();
    await blocker;
    await pending;
  }
  return pending;
}

it("accepts only the initiating raw session for writes and exact same-state replay", async () => {
  const f = await fixture();
  const saved = await selections.command(f.input);
  expect(await selections.command(f.input)).toEqual(saved);
  const before = await state(f);
  expect([before.selections.length, before.audits.length]).toEqual([1, 1]);
  const other = await identity();
  const tokens = [
    "",
    `unknown-${f.key}`,
    createHash("sha256").update(f.token).digest("hex"),
    other.token,
  ];
  await sessionRepository.create({
    id: `${f.sessionId}_survivor`,
    userId: f.userId,
    token: `${f.token}_survivor`,
    expiresAt: new Date(Date.now() + 3600000),
  });
  await sessionRepository.delete(f.token);
  tokens.push(f.token);
  for (const currentToken of tokens) {
    await expect(selections.command({ ...f.input, currentToken })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      selections.command({
        ...f.input,
        currentToken,
        command: { mode: "latest", expectedRevision: 1 },
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  }
  expect(await state(f)).toEqual(before);
  expect(JSON.stringify(before)).not.toContain(f.token);
  expect(JSON.stringify(before)).not.toContain(createHash("sha256").update(f.token).digest("hex"));
});

it.each(["advisory", "product", "actor", "grant", "selection", "build"] as const)(
  "rejects revocation during the %s lock wait",
  async (target) => {
    const f = await fixture();
    if (target === "selection") await selections.command(f.input);
    const before = await state(f);
    expect(await duringWait(f, target, () => sessionRepository.delete(f.token))).toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
    expect(await state(f)).toEqual(before);
  },
  20000,
);

it("rejects session deletion committed by the session-row blocker on exact replay", async () => {
  const f = await fixture();
  await selections.command(f.input);
  const before = await state(f);
  expect(
    await duringWait(
      f,
      "session",
      async () => {},
      (tx) => tx.delete(sessions).where(eq(sessions.id, f.sessionId)),
    ),
  ).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect(await state(f)).toEqual(before);
}, 20000);

it.each(["session", "entitlement", "license"] as const)(
  "uses fresh database time for %s expiry after the session wait",
  async (expiry) => {
    const f = await fixture(expiry === "license" ? "license" : "entitlement"),
      before = await state(f),
      staleNow = Date.now(),
      expiresAt = new Date(staleNow + 1500);
    if (expiry === "session")
      await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
    else if (expiry === "entitlement")
      await db.update(entitlements).set({ expiresAt }).where(eq(entitlements.id, f.accessId));
    else await db.update(licenses).set({ expiresAt }).where(eq(licenses.id, f.accessId));
    const clock = vi.spyOn(Date, "now").mockReturnValue(staleNow);
    try {
      expect(
        await duringWait(f, "session", async () => {
          await expect
            .poll(
              async () => {
                const [row] = await db.execute<{ expired: boolean }>(
                  sql`select clock_timestamp()>=${expiresAt}::timestamptz as expired`,
                );
                return row.expired;
              },
              { timeout: 5000, interval: 10 },
            )
            .toBe(true);
        }),
      ).toMatchObject({ error: { code: expiry === "session" ? "UNAUTHORIZED" : "NOT_FOUND" } });
    } finally {
      clock.mockRestore();
    }
    expect(await state(f)).toEqual(before);
  },
  20000,
);

it("rejects a fixed build withdrawn by the build blocker", async () => {
  const f = await fixture(),
    before = await state(f);
  expect(
    await duringWait(
      f,
      "build",
      async () => {},
      (tx) => tx.update(builds).set({ status: "draft" }).where(eq(builds.id, f.buildId)),
    ),
  ).toMatchObject({ error: { code: "LIBRARY_RELEASE_UNAVAILABLE" } });
  expect(await state(f)).toEqual(before);
}, 20000);
