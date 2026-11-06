import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { resourceReleaseWatchesWorkerState } = await import(
    "./helpers/resource-release-watches-worker-harness"
  );
  return { enqueueWebPushWithRecoveryWithin: resourceReleaseWatchesWorkerState.enqueue };
});

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReleaseWatchesWorkerDbMock } = await import(
    "./helpers/resource-release-watches-worker-harness"
  );
  return createResourceReleaseWatchesWorkerDbMock();
});

import { buildRepository } from "../packages/db/src/repositories/builds";
import {
  installResourceReleaseWatchesWorkerHooks,
  resourceReleaseWatchesWorkerBuildRow as buildRow,
  resourceReleaseWatchesWorkerState as state,
} from "./helpers/resource-release-watches-worker-harness";

installResourceReleaseWatchesWorkerHooks();

it.each(["approve", "reject"] as const)(
  "moderation persists release work only for a successful approval (%s)",
  async (decision) => {
    const artifact: Record<string, unknown> = {
      id: "bld_a",
      productId: "prd_a",
      version: "2.0.0",
      status: decision === "approve" ? "published" : "rejected",
      revision: 4,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 7,
      createdAt: "2026-10-11T00:00:00Z",
      scannedAt: "2026-10-11T00:00:00Z",
    };
    state.rows = [
      [["prd_a"]],
      [["prd_a", "published", "usr_a", null, false]],
      [["moderator"]],
      [["ses_staff", "2099-01-01T00:00:00.000Z"]],
      [buildRow(artifact)],
      [["prd_a", "Resource", "usr_a", null]],
      decision === "approve" ? [["bld_a", "2.0.0"]] : [],
      [],
      [],
      [],
      [],
      [],
    ];
    const audit = {
      id: "aud_a",
      actorId: "usr_staff",
      actorType: "user" as const,
      action: "build.reviewed",
      targetType: "build",
      targetId: "bld_a",
    };
    expect(
      await buildRepository.moderatePending("bld_a", decision, audit, 3, "staff-session"),
    ).toMatchObject({
      id: "bld_a",
    });
    const event = state.queries.find((query) =>
      query.sql.startsWith('insert into "resource_release_events"'),
    );
    if (decision === "approve") {
      expect(event?.params).toEqual(["prd_a", "bld_a", "2.0.0", "a".repeat(64), 7]);
      expect(event?.sql).toContain('on conflict ("build_id") do nothing');
      expect(state.queries.at(-1)).toBe(event);
    } else expect(event).toBeUndefined();
    expect(state.queries.some((query) => query.sql.startsWith('insert into "audit_events"'))).toBe(
      true,
    );
  },
);

it("a stale moderation decision creates no release work, inbox or audit", async () => {
  state.rows = [
    [["prd_a"]],
    [["prd_a", "published", "usr_a", null, false]],
    [["moderator"]],
    [["ses_staff", "2099-01-01T00:00:00.000Z"]],
    [],
  ];
  expect(
    await buildRepository.moderatePending(
      "bld_a",
      "approve",
      {
        id: "aud_a",
        actorId: "usr_staff",
        actorType: "user",
        action: "build.approved",
        targetType: "build",
        targetId: "bld_a",
      },
      3,
      "staff-session",
    ),
  ).toBeNull();
  expect(state.queries).toHaveLength(5);
  expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
});
