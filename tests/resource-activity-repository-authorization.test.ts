import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceActivityRepositoryDbMock } = await import(
    "./helpers/resource-activity-repository-harness"
  );
  return createResourceActivityRepositoryDbMock();
});

import { ResourceDownloadAuthorizationRepository } from "../packages/db/src/repositories/resource-download-authorization";
import {
  installResourceActivityRepositoryHooks,
  resourceActivityRepositoryBuildRow as buildRow,
  resourceActivityRepositoryExpected as expected,
  resourceActivityRepositoryNow as now,
  resourceActivityRepositoryState as state,
} from "./helpers/resource-activity-repository-harness";

const downloads = new ResourceDownloadAuthorizationRepository();

installResourceActivityRepositoryHooks();

it("denies a revoked license at the final gate without emitting a start audit", async () => {
  state.results = [
    [["prd_a", "resource", "published", "usr_author", null]],
    [["usr_buyer", "user"]],
    [["user"]],
    [],
    [],
  ];
  await expect(
    downloads.authorize({
      actorId: "usr_buyer",
      currentToken: "buyer-session",
      auditId: "aud_a",
      receiptId: "dlv_a",
      expected,
      pinned: false,
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  expect(state.queries.at(-1)?.params).toContain("active");
  expect(state.queries.at(-1)?.sql).toContain("for share");
});

it("audits a licensed transfer only after locking current access and unchanged artifact evidence", async () => {
  state.results = [
    [["prd_a", "resource", "published", "usr_author", null]],
    [["usr_buyer", "user"]],
    [["user"]],
    [],
    [["lic_a", "2026-10-11T00:00:00Z"]],
    [buildRow()],
    [["ses_buyer", "2099-01-01T00:00:00.000Z"]],
    [],
    [],
  ];
  expect(
    await downloads.authorize({
      actorId: "usr_buyer",
      currentToken: "buyer-session",
      auditId: "aud_a",
      receiptId: "dlv_a",
      expected,
      pinned: true,
    }),
  ).toEqual({ slug: "resource", receiptId: "dlv_a" });
  const audit = state.queries.at(-1);
  expect(audit?.params).toContain("product.download_started");
  expect(audit?.params).toContain(
    JSON.stringify({
      buildId: "bld_a",
      version: "1.0.0",
      pinned: true,
      accessSource: "license",
      receiptId: "dlv_a",
    }),
  );
  expect(state.queries[4].sql).not.toContain('"key"');
  expect(state.queries[5].sql).toContain("for share");
  expect(state.queries[6].sql).toContain('"sessions"');
  expect(state.queries[6].sql).toContain("for update");
});

it.each([
  { status: "quarantined" },
  { scanner: "different" },
  { scannedAt: new Date(now.getTime() + 1) },
  { storageKey: "replaced.zip" },
  { sha256Hash: "b".repeat(64) },
  { version: "2.0.0" },
])("rejects changed storage evidence at the final gate: %j", async (change) => {
  state.results = [
    [["prd_a", "resource", "published", "usr_author", null]],
    [["usr_author", "developer"]],
    [buildRow(change)],
  ];
  await expect(
    downloads.authorize({
      actorId: "usr_author",
      currentToken: "author-session",
      auditId: "aud_a",
      receiptId: "dlv_a",
      expected,
      pinned: false,
    }),
  ).rejects.toMatchObject({ code: "BUILD_STATE_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});

it("rechecks expiry after waiting for artifact locks", async () => {
  state.results = [
    [["prd_a", "resource", "published", "usr_author", null]],
    [["usr_buyer", "user"]],
    [["user"]],
    [["ent_a", "2026-10-10T11:59:59Z"]],
    [buildRow()],
  ];
  await expect(
    downloads.authorize({
      actorId: "usr_buyer",
      currentToken: "buyer-session",
      auditId: "aud_a",
      receiptId: "dlv_a",
      expected,
      pinned: false,
    }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});

it("rejects a resource archived during storage preparation", async () => {
  state.results = [[["prd_a", "resource", "archived", "usr_author", null]]];
  await expect(
    downloads.authorize({
      actorId: "usr_author",
      currentToken: "author-session",
      auditId: "aud_a",
      receiptId: "dlv_a",
      expected,
      pinned: false,
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
});
