import { randomBytes, randomUUID } from "node:crypto";
import {
  auditEvents,
  builds,
  db,
  entitlements,
  licenseControlsRepository as controls,
  licenseRuntimeBindings as bindings,
  licenses,
  products,
  resourceAcquisitionEvents,
  resourceCartAcquisitions,
  resourceCartItems,
  resourceCartRepository as cart,
  serverRepository,
  sessionRepository,
  sessions,
  userRepository,
  users,
} from "@nexus/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";

const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
async function account(role: "user" | "moderator" = "moderator") {
  const userId = id("usr_license_session");
  const token = id("token");
  const sessionId = id("ses");
  await userRepository.create({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "License initiating session fixture",
    role,
  });
  await sessionRepository.create({
    id: sessionId,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  // Another live session must never substitute for the initiating session.
  await sessionRepository.create({
    id: id("ses_other"),
    userId,
    token: id("other-token"),
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { userId, token, sessionId };
}
let fixturePort = 22003;
async function fixture() {
  const actor = await account();
  const productId = id("prd_z_license");
  const serverId = id("srv_license");
  const licenseId = id("lic_session");
  const expiresAt = new Date(Date.now() + 86400000);
  await db.insert(products).values({
    id: productId,
    authorId: actor.userId,
    title: "Recorded free resource",
    description: "Safe fixture",
    slug: productId,
    type: "script",
    status: "published",
  });
  await db.insert(builds).values({
    id: id("bld"),
    productId,
    version: "1.0.0",
    status: "published",
    storageKey: `fixture/${productId}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
    scanStatus: "clean",
    scanner: "integration-test",
    scannedAt: new Date(),
  });
  await serverRepository.create({
    id: serverId,
    ownerId: actor.userId,
    name: "Recorded server",
    slug: serverId,
    ipAddress: "198.51.100.181",
    port: fixturePort++,
    status: "active",
    visibility: "public",
    isVerified: true,
    mediaUrls: [],
    gameplayTags: [],
  });
  await db.insert(licenses).values({
    id: licenseId,
    key: id("private_key"),
    userId: actor.userId,
    productId,
    serverId,
    model: "single_server",
    status: "active",
    expiresAt,
  });
  await db.insert(bindings).values({
    licenseId,
    serverId,
    serverOwnerId: actor.userId,
    endpointRevision: 0,
  });
  await db
    .update(bindings)
    .set({
      tokenDigest: randomBytes(32).toString("hex"),
      tokenIssuedAt: new Date(),
      tokenExpiresAt: expiresAt,
    })
    .where(eq(bindings.licenseId, licenseId));
  const [license] = await db.select().from(licenses).where(eq(licenses.id, licenseId));
  return {
    ...actor,
    productId,
    serverId,
    licenseId,
    expiresAt,
    input: {
      licenseId,
      actorId: actor.userId,
      currentToken: actor.token,
      auditId: id("aud"),
      command: {
        action: "revoke_token" as const,
        reason: "Invalidate recorded credential",
        expectedUpdatedAt: license.updatedAt.toISOString(),
      },
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function snapshot(f: Fixture) {
  return {
    license: await db.select().from(licenses).where(eq(licenses.id, f.licenseId)),
    binding: await db.select().from(bindings).where(eq(bindings.licenseId, f.licenseId)),
    audit: await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.licenseId)),
  };
}
function moderation(f: Fixture) {
  return { ...f.input, command: { ...f.input.command, action: "suspend" as const } };
}
for (const invalid of ["revoked", "expired", "foreign", "missing"] as const) {
  it(`rejects owner and moderator writes with a ${invalid} initiating session without changing credentials or audit`, async () => {
    const f = await fixture();
    let currentToken = f.token;
    if (invalid === "revoked") await sessionRepository.delete(f.token);
    if (invalid === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (invalid === "foreign") currentToken = (await account()).token;
    if (invalid === "missing") currentToken = "";
    const before = await snapshot(f);
    await expect(controls.ownerCommand({ ...f.input, currentToken })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(controls.moderate({ ...moderation(f), currentToken })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(await snapshot(f)).toEqual(before);
  });
}
it("checks current ownership and the moderator role despite a live initiating session", async () => {
  const f = await fixture();
  const stranger = await account();
  const before = await snapshot(f);
  await expect(
    controls.ownerCommand({ ...f.input, actorId: stranger.userId, currentToken: stranger.token }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.userId));
  await expect(controls.moderate(moderation(f))).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await snapshot(f)).toEqual(before);
});
it("commits one valid owner command and rejects its replay without a second audit", async () => {
  const f = await fixture();
  const result = await controls.ownerCommand(f.input);
  expect(result.license.updatedAt).not.toBe(f.input.command.expectedUpdatedAt);
  const saved = await snapshot(f);
  expect(saved.binding[0]).toMatchObject({ tokenDigest: null, tokenExpiresAt: null });
  expect(saved.license[0].expiresAt).toEqual(f.expiresAt);
  expect(saved.audit).toHaveLength(1);
  expect(JSON.stringify(saved.audit)).not.toContain(f.token);
  await sessionRepository.delete(f.token);
  await expect(
    controls.ownerCommand({
      ...f.input,
      command: {
        ...f.input.command,
        expectedUpdatedAt: result.license.updatedAt,
      },
    }),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(controls.ownerCommand(f.input)).rejects.toBeDefined();
  expect(await snapshot(f)).toEqual(saved);
});
function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForLock(table: string, mode = "") {
  await expect
    .poll(
      async () => {
        const [row] = await db.execute<{ waiting: boolean }>(sql`select exists (
      select 1 from pg_stat_activity where datname = current_database()
      and pid <> pg_backend_pid() and wait_event_type = 'Lock'
      and query like ${`%"${table}"%for ${mode}%`}
    ) as waiting`);
        return row.waiting;
      },
      { timeout: 10000, interval: 10 },
    )
    .toBe(true);
}
async function block(f: Fixture, table: "licenses" | "license_runtime_bindings" | "sessions") {
  const locked = deferred(),
    release = deferred();
  const column = table === "license_runtime_bindings" ? "license_id" : "id";
  const value = table === "sessions" ? f.sessionId : f.licenseId;
  const pending = db.transaction(async (tx) => {
    await tx.execute(sql`select ${sql.identifier(column)} from ${sql.identifier(table)}
      where ${sql.identifier(column)} = ${value} for update`);
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, pending]);
  return {
    release: async () => {
      release.resolve();
      await pending;
    },
  };
}
for (const [action, table] of [
  ["owner", "license_runtime_bindings"],
  ["moderator", "licenses"],
] as const) {
  it(`rejects ${action} authorization revoked during a ${table} lock wait`, async () => {
    const f = await fixture();
    const before = await snapshot(f);
    const blocker = await block(f, table);
    const pending = (
      action === "owner" ? controls.ownerCommand(f.input) : controls.moderate(moderation(f))
    ).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForLock(table);
      await sessionRepository.delete(f.token);
    } finally {
      await blocker.release();
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await snapshot(f)).toEqual(before);
  }, 20000);
}
it("rechecks the current moderator after waiting for the license", async () => {
  const f = await fixture();
  const before = await snapshot(f);
  const blocker = await block(f, "licenses");
  const pending = controls.moderate(moderation(f)).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForLock("licenses");
    await db.update(users).set({ role: "user" }).where(eq(users.id, f.userId));
  } finally {
    await blocker.release();
  }
  expect(await pending).toMatchObject({ error: { code: "FORBIDDEN" } });
  expect(await snapshot(f)).toEqual(before);
}, 20000);
it("rejects session expiry during a moderator session-row wait", async () => {
  const f = await fixture();
  const before = await snapshot(f);
  const expiresAt = new Date(Date.now() + 1500);
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
  const blocker = await block(f, "sessions");
  const pending = controls.moderate(moderation(f)).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForLock("sessions");
    await expect
      .poll(() => Date.now() >= expiresAt.getTime(), { timeout: 5000, interval: 10 })
      .toBe(true);
  } finally {
    await blocker.release();
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect(await snapshot(f)).toEqual(before);
}, 20000);

for (const scenario of ["owner", "moderator", "revoked"] as const) {
  it(`completes a two-resource cart competing with a ${scenario} license command using the same session`, async () => {
    const f = await fixture();
    const firstId = id("prd_a_cart");
    await db.insert(products).values({
      id: firstId,
      authorId: f.userId,
      title: "First safe resource",
      description: "Safe fixture",
      slug: firstId,
      type: "script",
      status: "published",
    });
    await db.insert(builds).values({
      id: id("bld"),
      productId: firstId,
      version: "1.0.0",
      status: "published",
      storageKey: `fixture/${firstId}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 7,
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
    });
    for (const productId of [firstId, f.productId]) await cart.add(f.userId, productId, f.token);
    const review = await cart.review(f.userId);
    if (!review.reviewDigest) throw new Error("Missing review digest");
    const cartInput = {
      userId: f.userId,
      currentToken: f.token,
      requestId: randomUUID(),
      productIds: [firstId, f.productId],
      entitlementIds: [id("ent"), id("ent")],
      auditId: id("aud"),
      reviewDigest: review.reviewDigest,
    };
    const before = await snapshot(f);
    const blocker = await block(f, "license_runtime_bindings");
    const command = (
      scenario === "moderator" ? controls.moderate(moderation(f)) : controls.ownerCommand(f.input)
    ).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    let acquisition: ReturnType<typeof cart.acquire> | undefined;
    let outcome: Promise<{ value: unknown } | { error: unknown }> | undefined;
    try {
      // The real license command holds the later cart license and awaits its binding.
      await waitForLock("license_runtime_bindings");
      acquisition = cart.acquire(cartInput);
      outcome = acquisition.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      // The cart must await all later access rows before ever taking its session.
      await waitForLock("licenses", "share");
      if (scenario === "revoked") await sessionRepository.delete(f.token);
    } finally {
      await blocker.release();
    }
    const [commandResult, cartResult] = await Promise.all([command, outcome]);
    if (scenario === "revoked") {
      expect(commandResult).toMatchObject({ error: { code: "UNAUTHORIZED" } });
      expect(cartResult).toMatchObject({ error: { code: "UNAUTHORIZED" } });
      expect(await snapshot(f)).toEqual(before);
      const writes = await Promise.all([
        db.select().from(entitlements).where(eq(entitlements.subjectId, f.userId)),
        db
          .select()
          .from(resourceAcquisitionEvents)
          .where(eq(resourceAcquisitionEvents.userId, f.userId)),
        db
          .select()
          .from(resourceCartAcquisitions)
          .where(eq(resourceCartAcquisitions.userId, f.userId)),
      ]);
      for (const rows of writes) expect(rows).toHaveLength(0);
      expect(
        await db.select().from(resourceCartItems).where(eq(resourceCartItems.userId, f.userId)),
      ).toHaveLength(2);
    } else {
      expect(commandResult).toHaveProperty("value");
      const saved = await snapshot(f);
      expect(saved.license[0].expiresAt).toEqual(f.expiresAt);
      expect(saved.binding[0].tokenDigest).toBeNull();
      expect(saved.audit).toMatchObject([
        {
          actorId: f.userId,
          actorType: scenario === "moderator" ? "admin" : "user",
          action: scenario === "moderator" ? "license.suspended" : "license.token_revoked",
          details: { previousStatus: "active", termChanged: false },
        },
      ]);
      expect(cartResult).toMatchObject({
        value: {
          acquired: [
            { productId: firstId, alreadyClaimed: false },
            { productId: f.productId, alreadyClaimed: scenario === "owner" },
          ],
        },
      });
      const result = await acquisition;
      expect(await cart.acquire(cartInput)).toEqual(result);
      const [receipt] = await db
        .select()
        .from(resourceCartAcquisitions)
        .where(
          and(
            eq(resourceCartAcquisitions.userId, f.userId),
            eq(resourceCartAcquisitions.requestId, cartInput.requestId),
          ),
        );
      expect(receipt.reviewDigest).toBe(review.reviewDigest);
      expect(receipt.reviewSnapshot).toMatchObject([
        { productId: firstId, accessSource: "entitlement", recordedExpiresAt: null },
        {
          productId: f.productId,
          accessSource: scenario === "owner" ? "license" : "entitlement",
          recordedExpiresAt: scenario === "owner" ? f.expiresAt.toISOString() : null,
        },
      ]);
      const events = await db
        .select()
        .from(resourceAcquisitionEvents)
        .where(eq(resourceAcquisitionEvents.userId, f.userId))
        .orderBy(asc(resourceAcquisitionEvents.productId));
      expect(events).toHaveLength(scenario === "owner" ? 1 : 2);
    }
  }, 20000);
}
