import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../../packages/db/src/client", async () => {
  const { createLicenseControlsDbMock } = await import("../helpers/license-controls-harness");
  return createLicenseControlsDbMock();
});

import { LicenseControlsRepository } from "../../packages/db/src/repositories/license-controls";
import {
  future,
  now,
  releaseCommand,
  resetLicenseControlsState,
  revision,
  licenseControlsState as state,
} from "../helpers/license-controls-harness";

const repository = new LicenseControlsRepository();

beforeEach(() => {
  resetLicenseControlsState();
});

it("checks the current token again with expiry, scope, provenance and fixed endpoint", async () => {
  state.results = [[["usr_a"]], [["lic_a", "prd_a", "srv_a", future, now]]];
  expect(await repository.verify("a".repeat(64), "srv_a")).toMatchObject({
    valid: true,
    serverId: "srv_a",
    expiresAt: future,
  });
  const query = state.queries[1];
  for (const fragment of [
    "token_digest",
    "token_expires_at",
    "expires_at",
    "endpoint_revision",
    "scanner",
    "scanned_at",
    "organization_members",
    "server_claim_challenges",
  ])
    expect(query.sql).toContain(fragment);
  expect(query.params).toEqual(
    expect.arrayContaining([
      "a".repeat(64),
      "srv_a",
      "usr_a",
      "active",
      "single_server",
      "published",
      "clean",
    ]),
  );
  expect(query.sql).not.toContain('"licenses"."key"');
});

it("denies missing, rotated or expired tokens without identifying a license", async () => {
  state.results = [[]];
  expect(await repository.verify("a".repeat(64), "srv_a")).toBeNull();
  state.results = [[["usr_a"]], []];
  expect(await repository.verify("a".repeat(64), "srv_a")).toBeNull();
  state.results = [[["usr_a"]], [["lic_a", "prd_a", "srv_a", now, now]]];
  expect(await repository.verify("a".repeat(64), "srv_a")).toBeNull();
});

it("checks the exact release under current grants, control proof, scan provenance and owner snapshot", async () => {
  state.results = [
    [["usr_a"]],
    [["lic_a", "prd_a", "srv_a", "bld_a", "1.0", releaseCommand.sha256Hash, future, now]],
  ];
  const result = await repository.verifyRelease("a".repeat(64), releaseCommand);
  expect(result).toMatchObject({
    valid: true,
    nonce: releaseCommand.nonce,
    leaseExpiresAt: "2026-10-10T01:01:00.000Z",
    recheckAfterSeconds: 30,
  });
  const query = state.queries[1];
  expect(query.params).toEqual(
    expect.arrayContaining([
      "usr_a",
      "srv_a",
      "prd_a",
      "bld_a",
      releaseCommand.sha256Hash,
      "published",
      "clean",
    ]),
  );
  for (const field of [
    "server_owner_id",
    "endpoint_revision",
    "token_expires_at",
    "server_claim_challenges",
    "organization_members",
    "file_size_bytes",
    "scanner",
    "scanned_at",
  ])
    expect(query.sql).toContain(field);
  for (const privateField of ['"licenses"."key"', "storage_key"])
    expect(query.sql).not.toContain(privateField);
});

it("caps the runtime lease at actual token/license expiry and denies unusable release checks", async () => {
  state.results = [
    [["usr_a"]],
    [
      [
        "lic_a",
        "prd_a",
        "srv_a",
        "bld_a",
        "1.0",
        releaseCommand.sha256Hash,
        "2026-10-10T01:00:12.000Z",
        now,
      ],
    ],
  ];
  expect(await repository.verifyRelease("a".repeat(64), releaseCommand)).toMatchObject({
    leaseExpiresAt: "2026-10-10T01:00:12.000Z",
    recheckAfterSeconds: 12,
  });
  for (const rows of [[], [["usr_a"]]]) {
    state.results = [rows, []];
    expect(await repository.verifyRelease("a".repeat(64), releaseCommand)).toBeNull();
  }
  state.results = [
    [["usr_a"]],
    [["lic_a", "prd_a", "srv_a", "bld_a", "1.0", releaseCommand.sha256Hash, now, now]],
  ];
  expect(await repository.verifyRelease("a".repeat(64), releaseCommand)).toBeNull();
});

it("paginates private history using stable ordering and projects no actor IDs or raw details", async () => {
  state.results = [
    [["lic_a", "Resource"]],
    [[41]],
    [["aud_a", "license.bound", "user", "Reason", null, null, revision]],
  ];
  const result = await repository.historyPage("lic_a", "usr_a", false, 2);
  expect(result).toMatchObject({
    page: 2,
    pageSize: 20,
    total: 41,
    totalPages: 3,
    items: [{ fromEndpointRevision: null, toEndpointRevision: null }],
  });
  expect(state.queries[0].params).toContain("usr_a");
  expect(state.queries[2].sql).toContain(
    'order by "audit_events"."created_at" desc, "audit_events"."id" desc',
  );
  expect(state.queries[2].params.slice(-2)).toEqual([20, 20]);
  expect(state.queries[2].sql).not.toContain('"actor_id"');
  expect(state.queries[2].sql).toContain("left(");
  expect(state.options[0]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});

it("denies history and runtime configuration before querying releases or audit for foreign buyers", async () => {
  state.results = [[]];
  await expect(repository.historyPage("lic_a", "usr_other")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(1);
  state.queries = [];
  state.results = [[]];
  await expect(repository.releasePage("lic_a", "usr_other")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain("server_owner_id");
});
