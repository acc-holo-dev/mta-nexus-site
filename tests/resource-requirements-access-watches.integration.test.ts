import { expect, it, vi } from "vitest";
import {
  and,
  auditEvents,
  batchFixture,
  db,
  entitlements,
  eq,
  fixture,
  inArray,
  libraryCollectionsRepository,
  notifications,
  products,
  randomUUID,
  releaseEvents,
  releaseWatches,
  resourceReleaseWatchesRepository,
  resourceReleaseWorkerRepository,
  selections,
  sessionRepository,
  sessions,
  sql,
  users,
  watchAfterWait,
  watchCommand,
  type WatchMode,
  watchState,
} from "./helpers/resource-requirements-access-harness";

it("enrolls collection resources from the current release baseline without changing pinned versions and confirms retries once", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    const preferences = await db
      .select()
      .from(selections)
      .where(eq(selections.userId, f.buyer))
      .orderBy(selections.productId);
    const items = f.ids.slice(0, 2).map((productId) => ({ productId, expectedRevision: 0 }));
    const command = { expectedCollectionRevision: 3, items };
    const result = await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command,
      auditId: `aud_watch_col_${f.key}`,
    });
    expect(result.changedCount).toBe(2);
    const retry = await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command,
      auditId: `aud_watch_retry_${f.key}`,
    });
    expect(retry.changedCount).toBe(0);
    expect(retry.items).toEqual(result.items);
    const watches = await db
      .select()
      .from(releaseWatches)
      .where(eq(releaseWatches.userId, f.buyer));
    const events = await db
      .select()
      .from(releaseEvents)
      .where(inArray(releaseEvents.productId, f.ids.slice(0, 2)));
    for (const watch of watches)
      expect(watch.lastSequence).toBe(
        events.find((event) => event.productId === watch.productId)?.sequence,
      );
    expect(
      await db
        .select()
        .from(selections)
        .where(eq(selections.userId, f.buyer))
        .orderBy(selections.productId),
    ).toEqual(preferences);
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.actorId, f.buyer),
            eq(auditEvents.action, "library.collection_release_watches_enabled"),
          ),
        ),
    ).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("rolls collection enrollment back on audit failure and rejects revoked grants or stale membership", async () => {
  const f = await batchFixture();
  try {
    const command = {
      expectedCollectionRevision: 3,
      items: f.ids.slice(0, 2).map((productId) => ({ productId, expectedRevision: 0 })),
    };
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command,
      auditId: `aud_req_${f.key}_0`,
    };
    await expect(resourceReleaseWatchesRepository.enableCollectionBatch(input)).rejects.toThrow();
    expect(
      await db.select().from(releaseWatches).where(eq(releaseWatches.userId, f.buyer)),
    ).toHaveLength(0);
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(
      resourceReleaseWatchesRepository.enableCollectionBatch({
        ...input,
        auditId: `aud_revoked_watch_${f.key}`,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
    await libraryCollectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command: {
        action: "remove",
        productId: f.ids[1] ?? "",
        expectedRevision: 3,
        requestId: randomUUID(),
      },
      newCollectionId: f.collectionId,
      receiptId: `lcr_watch_remove_${f.key}`,
      auditId: `aud_watch_remove_${f.key}`,
    });
    await expect(
      resourceReleaseWatchesRepository.enableCollectionBatch({
        ...input,
        auditId: `aud_stale_watch_${f.key}`,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_WATCH_COLLECTION_CONFLICT" });
    expect(
      await db.select().from(releaseWatches).where(eq(releaseWatches.userId, f.buyer)),
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

it("projects collection enrollment and batch stopping as own watch operations while masking titles after access loss", async () => {
  const f = await batchFixture();
  try {
    const command = {
      expectedCollectionRevision: 3,
      items: f.ids.slice(0, 2).map((productId) => ({ productId, expectedRevision: 0 })),
    };
    await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command,
      auditId: `aud_hist_watch_enable_${f.key}`,
    });
    await resourceReleaseWatchesRepository.disableBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      command: { items: command.items.map((item) => ({ ...item, expectedRevision: 1 })) },
      auditId: `aud_hist_watch_stop_${f.key}`,
    });
    const query = { days: 7 as const, page: 1, source: "all" as const, productId: f.ids[0] };
    const report = await resourceReleaseWatchesRepository.history(f.buyer, query);
    expect(report.total).toBe(2);
    expect(report.items.every((item) => item.changes?.length === 2)).toBe(true);
    expect(
      report.items.some(
        (item) => item.source === "collection" && item.changes?.every((change) => change.enabled),
      ),
    ).toBe(true);
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    const masked = await resourceReleaseWatchesRepository.history(f.buyer, query);
    expect(masked.total).toBe(2);
    expect(
      masked.items
        .flatMap((item) => item.changes ?? [])
        .every((change) => change.currentTitle === null && !change.currentAvailable),
    ).toBe(true);
    expect(
      (await resourceReleaseWatchesRepository.history(f.staff, { days: 7, page: 1, source: "all" }))
        .items,
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
it("keeps malformed watch audit details neutral instead of exposing raw fields or inferred state", async () => {
  const f = await fixture();
  try {
    await db.insert(auditEvents).values({
      id: `aud_bad_watch_${f.key}`,
      actorId: f.buyer,
      actorType: "user",
      action: "library.release_watch_changed",
      targetType: "product",
      targetId: f.ids[0] ?? "",
      details: { enabled: "false", revision: 1, private: "DO-NOT-EXPORT", lastSequence: "999" },
    });
    const report = await resourceReleaseWatchesRepository.history(f.buyer, {
      days: 7,
      page: 1,
      source: "individual",
    });
    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({ source: "unknown", changes: null });
    expect(JSON.stringify(report)).not.toContain("DO-NOT-EXPORT");
    expect(JSON.stringify(report)).not.toContain("lastSequence");
  } finally {
    await f.cleanup();
  }
});

it("enrolls and delivers finite-access releases using database time despite application clock skew", async () => {
  const f = await fixture();
  let clock: ReturnType<typeof vi.spyOn> | undefined;
  try {
    await db
      .update(entitlements)
      .set({ expiresAt: sql`clock_timestamp()+interval '10 minutes'` })
      .where(eq(entitlements.subjectId, f.buyer));
    await db
      .update(sessions)
      .set({ expiresAt: new Date("2099-01-01T00:00:00Z") })
      .where(inArray(sessions.userId, [f.staff, f.buyer, f.owner]));
    clock = vi.spyOn(Date, "now").mockReturnValue(new Date("2036-01-01T00:00:00Z").getTime());
    const start = await resourceReleaseWatchesRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId: f.ids[0] ?? "",
      command: { enabled: true, expectedRevision: 0 },
      auditId: `aud_watch_clock_${f.key}`,
    });
    expect(start).toMatchObject({ enabled: true, revision: 1 });
    await f.publishReplacement();
    await resourceReleaseWorkerRepository.runBatch(100);
    const inbox = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, f.buyer));
    expect(
      inbox.filter((row) => (row.data as { kind?: string } | null)?.kind === "resource_release"),
    ).toHaveLength(1);
    expect(await resourceReleaseWatchesRepository.detail(f.buyer, f.ids[0] ?? "")).toMatchObject({
      enabled: true,
      revision: 1,
    });
  } finally {
    clock?.mockRestore();
    await db.delete(auditEvents).where(eq(auditEvents.targetId, `${f.buyer}:${f.ids[0]}`));
    await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
    await f.cleanup();
  }
});
it("rolls back an individual watch on audit failure and preserves monotonic update times on retry", async () => {
  const f = await fixture();
  try {
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId: f.ids[0] ?? "",
      auditId: `aud_watch_atomic_${f.key}`,
    };
    await resourceReleaseWatchesRepository.command({
      ...input,
      command: { enabled: true, expectedRevision: 0 },
    });
    await db
      .update(releaseWatches)
      .set({ updatedAt: sql`clock_timestamp()+interval '1 hour'` })
      .where(eq(releaseWatches.userId, f.buyer));
    const before = await resourceReleaseWatchesRepository.detail(f.buyer, input.productId);
    await expect(
      resourceReleaseWatchesRepository.command({
        ...input,
        command: { enabled: false, expectedRevision: 1 },
      }),
    ).rejects.toThrow();
    expect(await resourceReleaseWatchesRepository.detail(f.buyer, input.productId)).toEqual(before);
    const stop = {
      ...input,
      auditId: `aud_watch_atomic_stop_${f.key}`,
      command: { enabled: false, expectedRevision: 1 },
    };
    const saved = await resourceReleaseWatchesRepository.command(stop);
    expect(saved.updatedAt.getTime()).toBeGreaterThan(before.updatedAt?.getTime() ?? 0);
    expect(
      await resourceReleaseWatchesRepository.command({
        ...stop,
        auditId: `aud_watch_atomic_retry_${f.key}`,
      }),
    ).toEqual(saved);
    const audits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.actorId, f.buyer),
          eq(auditEvents.action, "library.release_watch_changed"),
        ),
      );
    expect(audits).toHaveLength(2);
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
    await f.cleanup();
  }
});

it("resumes reviewed existing watches at current baselines while preserving pins, notices and one audit per operation", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    const preferenceRows = await db
      .select()
      .from(selections)
      .where(eq(selections.userId, f.buyer))
      .orderBy(selections.productId);
    const ids = f.ids.slice(0, 2);
    await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      auditId: `aud_resume_enroll_${f.key}`,
      command: {
        expectedCollectionRevision: 3,
        items: ids.map((productId) => ({ productId, expectedRevision: 0 })),
      },
    });
    await resourceReleaseWatchesRepository.disableBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      auditId: `aud_resume_stop_${f.key}`,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 1 })) },
    });
    await f.publishReplacement();
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      auditId: `aud_resume_apply_${f.key}`,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 2 })) },
    };
    const result = await resourceReleaseWatchesRepository.resumeBatch(input);
    expect(result.changedCount).toBe(2);
    expect(result.items.every((item) => item.enabled && item.revision === 3)).toBe(true);
    const rows = await db.select().from(releaseWatches).where(eq(releaseWatches.userId, f.buyer));
    const events = await db
      .select()
      .from(releaseEvents)
      .where(inArray(releaseEvents.productId, ids));
    for (const row of rows)
      expect(row.lastSequence).toBe(
        events
          .filter((event) => event.productId === row.productId)
          .reduce((max, event) => (event.sequence > max ? event.sequence : max), 0n),
      );
    expect(
      (
        await resourceReleaseWatchesRepository.resumeBatch({
          ...input,
          auditId: `aud_resume_retry_${f.key}`,
        })
      ).changedCount,
    ).toBe(0);
    const history = await resourceReleaseWatchesRepository.history(f.buyer, {
      page: 1,
      days: 7,
      source: "batch",
    });
    expect(history.total).toBe(2);
    expect(history.items.some((item) => item.changes?.every((change) => change.enabled))).toBe(
      true,
    );
    await resourceReleaseWorkerRepository.runBatch(100);
    expect(
      await db.select().from(notifications).where(eq(notifications.recipientId, f.buyer)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(selections)
        .where(eq(selections.userId, f.buyer))
        .orderBy(selections.productId),
    ).toEqual(preferenceRows);
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
    await f.cleanup();
  }
});
it("rolls group resumption back on required audit failure and rejects a selected resource after access loss", async () => {
  const f = await batchFixture();
  try {
    const ids = f.ids.slice(0, 2);
    await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      auditId: `aud_resume_atomic_enable_${f.key}`,
      command: {
        expectedCollectionRevision: 3,
        items: ids.map((productId) => ({ productId, expectedRevision: 0 })),
      },
    });
    await resourceReleaseWatchesRepository.disableBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      auditId: `aud_resume_atomic_stop_${f.key}`,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 1 })) },
    });
    const before = await db
      .select()
      .from(releaseWatches)
      .where(eq(releaseWatches.userId, f.buyer))
      .orderBy(releaseWatches.productId);
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      auditId: `aud_resume_atomic_stop_${f.key}`,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 2 })) },
    };
    await expect(resourceReleaseWatchesRepository.resumeBatch(input)).rejects.toThrow();
    expect(
      await db
        .select()
        .from(releaseWatches)
        .where(eq(releaseWatches.userId, f.buyer))
        .orderBy(releaseWatches.productId),
    ).toEqual(before);
    await db
      .delete(entitlements)
      .where(and(eq(entitlements.subjectId, f.buyer), eq(entitlements.resourceId, ids[0] ?? "")));
    await expect(
      resourceReleaseWatchesRepository.resumeBatch({
        ...input,
        auditId: `aud_resume_lost_${f.key}`,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
    expect(
      await db
        .select()
        .from(releaseWatches)
        .where(eq(releaseWatches.userId, f.buyer))
        .orderBy(releaseWatches.productId),
    ).toEqual(before);
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
    await f.cleanup();
  }
});

// Real PostgreSQL guards for the token which initiated each watch mutation.
it.each<WatchMode>(["single", "collection", "resume", "stop"])(
  "%s watch mutations and complete replays require the live initiating token",
  async (mode) => {
    const f = await batchFixture();
    try {
      const mutate = await watchCommand(f, mode);
      const expired = `tok_expired_${f.key}`,
        revoked = `tok_revoked_${f.key}`,
        rotated = `tok_rotated_${f.key}`;
      for (const [name, token, expiresAt] of [
        ["expired", expired, new Date(Date.now() - 60000)],
        ["revoked", revoked, new Date(Date.now() + 3600000)],
        ["rotated", rotated, new Date(Date.now() + 3600000)],
      ] as const)
        await sessionRepository.create({
          id: `ses_${name}_${f.key}`,
          userId: f.buyer,
          token,
          expiresAt,
        });
      await db.delete(sessions).where(eq(sessions.id, `ses_revoked_${f.key}`));
      await db
        .update(sessions)
        .set({ token: `replacement_${f.key}` })
        .where(eq(sessions.id, `ses_rotated_${f.key}`));
      for (const replay of [false, true]) {
        if (replay) await mutate();
        const before = await watchState(f);
        for (const token of ["", `missing_${f.key}`, `tok_${f.staff}`, expired, revoked, rotated]) {
          await expect(mutate(token)).rejects.toMatchObject({ statusCode: 401 });
          expect(await watchState(f)).toEqual(before);
        }
        if (replay) {
          await mutate();
          expect(await watchState(f)).toEqual(before);
        }
      }
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
      await f.cleanup();
    }
  },
);
it.each([
  ["single", "account"],
  ["single", "product"],
  ["single", "grant"],
  ["collection", "advisory"],
  ["collection", "membership"],
  ["stop", "watch"],
  ["resume", "session"],
] as const)(
  "%s rechecks a revoked initiator after a real %s lock wait without partial writes",
  async (mode, lock) => {
    const f = await batchFixture();
    try {
      const mutate = await watchCommand(f, mode),
        before = await watchState(f);
      const outcome = await watchAfterWait(
        async (tx) => {
          if (lock === "account")
            return tx.select().from(users).where(eq(users.id, f.buyer)).for("update");
          if (lock === "product")
            return tx
              .select()
              .from(products)
              .where(eq(products.id, f.ids[0] ?? ""))
              .for("update");
          if (lock === "grant")
            return tx
              .select()
              .from(entitlements)
              .where(eq(entitlements.subjectId, f.buyer))
              .for("update");
          if (lock === "advisory")
            return tx.execute(
              sql`select pg_advisory_xact_lock(hashtext(${`library-collections:${f.buyer}`}))`,
            );
          if (lock === "membership")
            return tx.execute(
              sql`select 1 from library_collection_items where collection_id=${f.collectionId} for update`,
            );
          if (lock === "watch")
            return tx
              .select()
              .from(releaseWatches)
              .where(eq(releaseWatches.userId, f.buyer))
              .for("update");
          return tx
            .select()
            .from(sessions)
            .where(eq(sessions.id, `ses_${f.buyer}`))
            .for("update");
        },
        mutate,
        (tx) => tx.delete(sessions).where(eq(sessions.id, `ses_${f.buyer}`)),
      );
      expect(outcome).toMatchObject({ ok: false, error: { statusCode: 401 } });
      expect(await watchState(f)).toEqual(before);
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
      await f.cleanup();
    }
  },
  10000,
);
it.each([
  ["single", false],
  ["single", true],
  ["collection", false],
  ["collection", true],
  ["resume", false],
  ["resume", true],
] as const)(
  "%s rejects finite access that expires during the final session wait (replay=%s)",
  async (mode, replay) => {
    const f = await batchFixture();
    try {
      const mutate = await watchCommand(f, mode);
      if (replay) await mutate();
      const before = await watchState(f);
      await db
        .update(entitlements)
        .set({ expiresAt: sql`clock_timestamp()+interval '600 milliseconds'` })
        .where(eq(entitlements.subjectId, f.buyer));
      const outcome = await watchAfterWait(
        async (tx) => {
          await tx
            .select()
            .from(sessions)
            .where(eq(sessions.id, `ses_${f.buyer}`))
            .for("update");
        },
        mutate,
        (tx) => tx.execute(sql`select pg_sleep(0.7)`),
      );
      expect(outcome).toMatchObject({
        ok: false,
        error: mode === "single" ? { statusCode: 404 } : { code: "RELEASE_WATCH_UNAVAILABLE" },
      });
      expect(await watchState(f)).toEqual(before);
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
      await f.cleanup();
    }
  },
  10000,
);
