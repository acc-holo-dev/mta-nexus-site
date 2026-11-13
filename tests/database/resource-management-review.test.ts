import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../../site/packages/db/src/client", async () => {
  const { createResourceManagementDbMock } = await import("../helpers/resource-management-harness");
  return createResourceManagementDbMock();
});

import { BuildReviewDownloadRepository } from "../../site/packages/db/src/repositories/build-review-download";
import { builds } from "../../site/packages/db/src/schema";
import {
  artifact,
  resetResourceManagementState,
  row,
  resourceManagementState as state,
  updated,
} from "../helpers/resource-management-harness";

const review = new BuildReviewDownloadRepository();

beforeEach(() => {
  resetResourceManagementState();
});

it("authorizes reviewer evidence with live role and exact artifact before the audit commits", async () => {
  state.results = [
    [["prd_a"]],
    [["moderator"]],
    [row(builds, artifact as unknown as Record<string, unknown>)],
    [],
  ];
  await review.authorize({ actorId: "usr_mod", auditId: "aud_a", expected: artifact });
  expect(state.queries.map((query) => query.sql).join("\n")).toMatch(
    /products[\s\S]*for share[\s\S]*users[\s\S]*for share[\s\S]*builds[\s\S]*for share[\s\S]*insert into "audit_events"/,
  );
});
it("denies a reviewer whose role was revoked while opening storage", async () => {
  state.results = [[["prd_a"]], [["user"]]];
  await expect(
    review.authorize({ actorId: "usr_mod", auditId: "aud_a", expected: artifact }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.every((query) => !query.sql.startsWith("insert"))).toBe(true);
});
it.each([
  { status: "retired" },
  { storageKey: "private/changed.zip" },
  { scanStatus: "malicious" },
  { scanner: "different" },
  { scannedAt: new Date(updated) },
  { sha256Hash: "b".repeat(64) },
  { productId: "prd_b" },
])("denies changed reviewer evidence ($status $scanStatus $storageKey)", async (changed) => {
  state.results = [[["prd_a"]], [["moderator"]], [row(builds, { ...artifact, ...changed })]];
  await expect(
    review.authorize({ actorId: "usr_mod", auditId: "aud_a", expected: artifact }),
  ).rejects.toMatchObject({ code: "BUILD_STATE_CHANGED" });
  expect(state.queries.every((query) => !query.sql.startsWith("insert"))).toBe(true);
});
