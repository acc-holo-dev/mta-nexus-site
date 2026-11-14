import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../../packages/db/src/client", async () => {
  const { createLicenseControlsDbMock } = await import("../helpers/license-controls-harness");
  return createLicenseControlsDbMock();
});

import { LicenseControlsRepository } from "../../packages/db/src/repositories/license-controls";
import {
  actorRow,
  bindingRow,
  clockRow,
  future,
  now,
  owner,
  resetLicenseControlsState,
  revision,
  rotationResults,
  sessionRow,
  licenseControlsState as state,
  updated,
} from "../helpers/license-controls-harness";

const repository = new LicenseControlsRepository();

beforeEach(() => {
  resetLicenseControlsState();
});

it("hides another buyer's license before looking up servers or audit history", async () => {
  state.results = [[]];
  expect(await repository.detail("lic_a", "usr_b")).toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toContain("usr_b");
  expect(state.queries[0].sql).not.toMatch(/"key"|token_digest" as|entitlements/u);
  expect(state.options[0]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});

it("requires a live moderator role inside read scopes", async () => {
  state.results = [[]];
  expect(await repository.detail("lic_a", "usr_a", true)).toBeNull();
  expect(state.queries[0].sql).toContain('"users"."role" in');
  expect(state.queries[0].params).toEqual(expect.arrayContaining(["usr_a", "admin", "moderator"]));
});

it("revokes only the owner's license, clears the token, and audits without extending its term", async () => {
  state.results = [
    [["lic_a", "prd_a", "srv_a", "single_server", "active", future, revision]],
    [bindingRow()],
    actorRow,
    sessionRow,
    clockRow,
    [],
    [["lic_a", "revoked", updated]],
    [],
  ];
  const result = await repository.ownerCommand({
    ...owner,
    command: { action: "revoke", expectedUpdatedAt: revision, reason: "Revoke this license" },
  });
  expect(result.license.status).toBe("revoked");
  const updates = state.queries.filter((item) => item.sql.startsWith("update"));
  expect(updates[0].sql).toContain('"token_digest" =');
  expect(updates[0].params).toContain(null);
  expect(updates[1].sql).not.toContain('"expires_at" =');
  expect(state.queries.at(-1)?.params.join(" ")).toContain("license.revoked");
  expect(state.queries.at(-1)?.params.join(" ")).not.toContain("a".repeat(64));
});

it("cannot restore a revoked license or a suspended license past its paid term", async () => {
  for (const [status, expiry, code] of [
    ["revoked", future, "LICENSE_INACTIVE"],
    ["suspended", revision, "LICENSE_EXPIRED"],
    ["suspended", null, "LICENSE_FINITE_TERM_REQUIRED"],
  ] as const) {
    state.queries = [];
    state.results = [
      [["lic_a", status, expiry, revision, "srv_a"]],
      [],
      [["moderator"]],
      sessionRow,
      clockRow,
    ];
    await expect(
      repository.moderate({
        ...owner,
        command: {
          action: "restore",
          expectedUpdatedAt: revision,
          reason: "Restore unchanged term",
        },
      }),
    ).rejects.toMatchObject({ code });
    expect(state.queries.every((item) => item.sql.startsWith("select"))).toBe(true);
  }
});

it("requires actual control evidence and original ownership scope in server candidates", async () => {
  state.results = [[[null]], [], [[1]], [["srv_a", "Server A"]]];
  expect((await repository.eligibleServers("lic_a", "usr_a")).servers).toEqual([
    { id: "srv_a", name: "Server A" },
  ]);
  const sql = state.queries.at(-1)?.sql ?? "";
  for (const fragment of [
    "server_claim_challenges",
    "verification_requests",
    "endpoint_revision",
    "claim_organization_id",
    '"consumed_at" is not null',
    '"status" =',
  ])
    expect(sql).toContain(fragment);
  expect(state.queries.at(-1)?.params).toContain("approved");
  expect(state.queries.at(-1)?.params).toContain('["manage_servers"]');
});

it("recovers only the same verified server and clears its old token without extending the term", async () => {
  state.results = rotationResults(future, 3);
  const result = await repository.ownerCommand({
    ...owner,
    command: {
      action: "refresh_binding",
      expectedUpdatedAt: revision,
      expectedEndpointRevision: 3,
      reason: "Endpoint control reconfirmed",
    },
  });
  expect(result.binding).toEqual({ endpointRevision: 3, tokenRevoked: true });
  expect(result.tokenExpiresAt).toBeUndefined();
  const mutation = state.queries.find((item) =>
    item.sql.startsWith('update "license_runtime_bindings"'),
  );
  if (!mutation) throw new Error("Missing binding update");
  expect(mutation.sql).toContain('"endpoint_revision" =');
  expect(mutation.sql).toContain('"server_owner_id" =');
  for (const field of ["token_digest", "token_issued_at", "token_expires_at"])
    expect(mutation.sql).toContain(`"${field}" =`);
  expect(mutation.params).toEqual(expect.arrayContaining([3, "usr_a", null]));
  expect(mutation.sql).not.toContain('"server_id" =');
  expect(state.queries.find((item) => item.sql.startsWith('update "licenses"'))?.sql).not.toContain(
    '"expires_at" =',
  );
  const audit = state.queries.at(-1);
  if (!audit) throw new Error("Missing binding audit");
  expect(audit.params).toContain("license.binding_refreshed");
  expect(audit.params).toContain(
    JSON.stringify({
      reason: "Endpoint control reconfirmed",
      previousStatus: "active",
      status: "active",
      termChanged: false,
      fromEndpointRevision: 2,
      toEndpointRevision: 3,
      tokenRevoked: true,
    }),
  );
});

it("requires explicit recovery for unknown historical ownership before rotating a credential", async () => {
  const results = rotationResults();
  results[5] = [bindingRow({ serverOwnerId: null })];
  state.results = results;
  await expect(
    repository.ownerCommand({
      ...owner,
      tokenDigest: "b".repeat(64),
      command: {
        action: "rotate_token",
        expectedUpdatedAt: revision,
        reason: "Replace server credential",
      },
    }),
  ).rejects.toMatchObject({ code: "LICENSE_SERVER_CHANGED" });
  expect(state.queries.every((item) => item.sql.startsWith("select"))).toBe(true);
  state.queries = [];
  const recovery = rotationResults();
  recovery[5] = [bindingRow({ serverOwnerId: null })];
  state.results = recovery;
  expect(
    (
      await repository.ownerCommand({
        ...owner,
        command: {
          action: "refresh_binding",
          expectedUpdatedAt: revision,
          expectedEndpointRevision: 2,
          reason: "Reconfirm historical context",
        },
      })
    ).binding,
  ).toEqual({ endpointRevision: 2, tokenRevoked: true });
});

it("rejects unobserved endpoint changes and transfers of known ownership or organization", async () => {
  for (const [serverRow, expectedEndpointRevision] of [
    [["srv_a", null, 3, "usr_a"], 2],
    [["srv_a", null, 3, "usr_other"], 3],
    [["srv_a", "org_other", 3, "usr_a"], 3],
  ] as const) {
    state.queries = [];
    const results = rotationResults();
    results[9] = [[...serverRow]];
    state.results = results;
    await expect(
      repository.ownerCommand({
        ...owner,
        command: {
          action: "refresh_binding",
          expectedUpdatedAt: revision,
          expectedEndpointRevision,
          reason: "Reconfirm current context",
        },
      }),
    ).rejects.toMatchObject({ code: "LICENSE_SERVER_CHANGED" });
    expect(state.queries.every((item) => item.sql.startsWith("select"))).toBe(true);
  }
});

it("cannot recover without current server control evidence or an unchanged active finite term", async () => {
  for (const [index, replacement, code] of [
    [9, [], "LICENSE_SERVER_UNAVAILABLE"],
    [
      4,
      [["lic_a", "prd_a", "srv_a", "single_server", "active", null, revision]],
      "LICENSE_FINITE_TERM_REQUIRED",
    ],
    [4, [["lic_a", "prd_a", "srv_a", "single_server", "active", now, revision]], "LICENSE_EXPIRED"],
    [
      4,
      [["lic_a", "prd_a", "srv_a", "single_server", "revoked", future, revision]],
      "LICENSE_INACTIVE",
    ],
  ] as const) {
    state.queries = [];
    const results = rotationResults(future, 3);
    results[index] = replacement.map((row) => [...row]);
    state.results = results;
    await expect(
      repository.ownerCommand({
        ...owner,
        command: {
          action: "refresh_binding",
          expectedUpdatedAt: revision,
          expectedEndpointRevision: 3,
          reason: "Reconfirm current context",
        },
      }),
    ).rejects.toMatchObject({ code });
    expect(state.queries.every((item) => item.sql.startsWith("select"))).toBe(true);
  }
});

it("never moves an existing binding to a different server", async () => {
  state.results = rotationResults();
  await expect(
    repository.ownerCommand({
      ...owner,
      command: {
        action: "bind",
        serverId: "srv_other",
        expectedUpdatedAt: revision,
        reason: "Move to another server",
      },
    }),
  ).rejects.toMatchObject({ code: "LICENSE_ALREADY_BOUND" });
  expect(state.queries.every((item) => item.sql.startsWith("select"))).toBe(true);
});

it("keeps a durable binding recorded when a deleted server cleared the legacy foreign key", async () => {
  state.results = [
    [["lic_a", "active", future, revision, null]],
    [["lic_a"]],
    [["moderator"]],
    sessionRow,
    clockRow,
    [["srv_a"]],
    [["lic_a", "suspended", updated]],
    [],
  ];
  const result = await repository.moderate({
    ...owner,
    command: { action: "suspend", expectedUpdatedAt: revision, reason: "Suspend this license" },
  });
  expect(result.license.serverBound).toBe(true);
  expect(result.license.status).toBe("suspended");
});
