import { expect, it } from "vitest";
import {
  and,
  auditEvents,
  builds,
  db,
  entitlements,
  eq,
  fixture,
  resourceLibrarySelectionsRepository,
  selections,
} from "./helpers/resource-requirements-access-harness";

it("release comparison observes two exact published artifacts without exposing private package evidence", async () => {
  const f = await fixture();
  try {
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing resource");
    await f.publishReplacement();
    const report = await resourceLibrarySelectionsRepository.compare(f.buyer, rootId, {
      from: `bld_req_${f.key}_0`,
      to: `bld_req_${f.key}_replacement`,
      returnPage: 2,
    });
    expect(report).toMatchObject({
      artifactState: "same",
      returnPage: 2,
      metadataChanges: { version: true },
      from: { version: "1.0.0" },
      to: { version: "2.0.0" },
    });
    expect(report.from.packageSummary).not.toBeNull();
    expect(JSON.stringify(report)).not.toMatch(
      /storageKey|packageEvidence|aclRights|referencesTruncated.*path/u,
    );
  } finally {
    await f.cleanup();
  }
});
it("release comparison rejects revoked rights, withdrawn artifacts and foreign releases", async () => {
  const f = await fixture();
  try {
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing resource");
    await f.publishReplacement();
    const query = { from: `bld_req_${f.key}_0`, to: `bld_req_${f.key}_replacement`, returnPage: 1 };
    await expect(
      resourceLibrarySelectionsRepository.compare(f.buyer, rootId, {
        ...query,
        to: `bld_req_${f.key}_1`,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await db.update(builds).set({ status: "deprecated" }).where(eq(builds.id, query.from));
    await expect(
      resourceLibrarySelectionsRepository.compare(f.buyer, rootId, query),
    ).rejects.toMatchObject({ statusCode: 404 });
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(
      resourceLibrarySelectionsRepository.compare(f.buyer, rootId, query),
    ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});
it("publisher and staff roles do not confer buyer comparison access", async () => {
  const f = await fixture();
  try {
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing resource");
    await f.publishReplacement();
    const query = { from: `bld_req_${f.key}_0`, to: `bld_req_${f.key}_replacement`, returnPage: 1 };
    for (const actorId of [f.owner, f.staff])
      await expect(
        resourceLibrarySelectionsRepository.compare(actorId, rootId, query),
      ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});

it("replays a lost single-selection response once without another audit", async () => {
  const f = await fixture();
  try {
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId: f.ids[0] ?? "",
      command: { mode: "fixed" as const, buildId: `bld_req_${f.key}_0`, expectedRevision: 0 },
      auditId: `aud_single_${f.key}`,
    };
    const first = await resourceLibrarySelectionsRepository.command(input);
    const retry = await resourceLibrarySelectionsRepository.command({
      ...input,
      auditId: `aud_retry_${f.key}`,
    });
    expect(retry).toEqual(first);
    expect(first.selection.revision).toBe(1);
    const events = await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.actorId, f.buyer), eq(auditEvents.action, "library.release_selected")),
      );
    expect(events).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("serializes competing single selections so one revision cannot overwrite another", async () => {
  const f = await fixture();
  try {
    await f.publishReplacement();
    const outcomes = await Promise.allSettled(
      [`bld_req_${f.key}_0`, `bld_req_${f.key}_replacement`].map((buildId, index) =>
        resourceLibrarySelectionsRepository.command({
          userId: f.buyer,
          currentToken: `tok_${f.buyer}`,
          productId: f.ids[0] ?? "",
          command: { mode: "fixed", buildId, expectedRevision: 0 },
          auditId: `aud_race_${f.key}_${index}`,
        }),
      ),
    );
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((r) => r.status === "rejected");
    expect(rejected && rejected.status === "rejected" ? rejected.reason : null).toMatchObject({
      code: "LIBRARY_RELEASE_CONFLICT",
    });
    const rows = await db.select().from(selections).where(eq(selections.userId, f.buyer));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revision).toBe(1);
  } finally {
    await f.cleanup();
  }
});
it("rolls a single selection back if its mandatory audit cannot be written", async () => {
  const f = await fixture();
  try {
    await expect(
      resourceLibrarySelectionsRepository.command({
        userId: f.buyer,
        currentToken: `tok_${f.buyer}`,
        productId: f.ids[0] ?? "",
        command: { mode: "fixed", buildId: `bld_req_${f.key}_0`, expectedRevision: 0 },
        auditId: `aud_req_${f.key}_0`,
      }),
    ).rejects.toThrow();
    expect(await db.select().from(selections).where(eq(selections.userId, f.buyer))).toHaveLength(
      0,
    );
  } finally {
    await f.cleanup();
  }
});

it("selects the exact comparison target with its observed preference revision and archive identity", async () => {
  const f = await fixture();
  try {
    await f.publishReplacement();
    const productId = f.ids[0] ?? "";
    const comparison = await resourceLibrarySelectionsRepository.compare(f.buyer, productId, {
      from: `bld_req_${f.key}_0`,
      to: `bld_req_${f.key}_replacement`,
      returnPage: 1,
    });
    expect(comparison.selection).toEqual({ revision: 0, mode: "latest", buildId: null });
    const command = {
      mode: "fixed" as const,
      buildId: comparison.to.id,
      expectedRevision: comparison.selection.revision,
      reviewedArtifact: {
        sha256Hash: comparison.to.sha256Hash,
        fileSizeBytes: comparison.to.fileSizeBytes,
      },
    };
    const selected = await resourceLibrarySelectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId,
      command,
      auditId: `aud_compared_${f.key}`,
    });
    expect(selected.selection).toMatchObject({
      mode: "fixed",
      revision: 1,
      buildId: comparison.to.id,
    });
    const replay = await resourceLibrarySelectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId,
      command,
      auditId: `aud_compared_retry_${f.key}`,
    });
    expect(replay).toEqual(selected);
    const snapshot = await resourceLibrarySelectionsRepository.compare(f.buyer, productId, {
      from: comparison.from.id,
      to: comparison.to.id,
      returnPage: 1,
    });
    expect(snapshot.selection).toEqual({ revision: 1, mode: "fixed", buildId: comparison.to.id });
  } finally {
    await f.cleanup();
  }
});
it("rejects a comparison choice after an intervening selection or revoked access", async () => {
  const f = await fixture();
  try {
    await f.publishReplacement();
    const productId = f.ids[0] ?? "";
    const comparison = await resourceLibrarySelectionsRepository.compare(f.buyer, productId, {
      from: `bld_req_${f.key}_0`,
      to: `bld_req_${f.key}_replacement`,
      returnPage: 1,
    });
    const command = {
      mode: "fixed" as const,
      buildId: comparison.to.id,
      expectedRevision: comparison.selection.revision,
      reviewedArtifact: {
        sha256Hash: comparison.to.sha256Hash,
        fileSizeBytes: comparison.to.fileSizeBytes,
      },
    };
    await resourceLibrarySelectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId,
      command: { mode: "fixed", buildId: comparison.from.id, expectedRevision: 0 },
      auditId: `aud_intervening_${f.key}`,
    });
    await expect(
      resourceLibrarySelectionsRepository.command({
        userId: f.buyer,
        currentToken: `tok_${f.buyer}`,
        productId,
        command,
        auditId: `aud_stale_review_${f.key}`,
      }),
    ).rejects.toMatchObject({ code: "LIBRARY_RELEASE_CONFLICT" });
    expect(
      (await db.select().from(selections).where(eq(selections.userId, f.buyer)))[0]?.buildId,
    ).toBe(comparison.from.id);
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(
      resourceLibrarySelectionsRepository.command({
        userId: f.buyer,
        currentToken: `tok_${f.buyer}`,
        productId,
        command: { ...command, expectedRevision: 1 },
        auditId: `aud_revoked_review_${f.key}`,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});
