import { beforeEach, expect, it, vi } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { canModerateLicense, LICENSE_RUNTIME_TOKEN_DAYS } from "@nexus/domain";
import { licenseOwnerCommandSchema, licenseModerationCommandSchema } from "@nexus/validation";
import { createLicenseRuntimeToken, digestLicenseRuntimeToken } from "@nexus/security";
import { confirmedLicenseControl } from "../apps/web/src/lib/license-control-confirmation";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { licenseRuntimeBindings } from "../packages/db/src/schema";
import { LicenseControlsRepository } from "../packages/db/src/repositories/license-controls";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
const repository = new LicenseControlsRepository();
const revision = "2026-10-10T00:00:00.000Z";
const now = "2026-10-10T01:00:00.000Z";
const future = "2026-10-20T00:00:00.000Z";
const updated = "2026-10-10T01:00:00.001Z";
const owner = {
  licenseId: "lic_a",
  actorId: "usr_a",
  auditId: "aud_a",
  currentToken: "session-owner",
};
const actorRow = [["usr_a"]];
const sessionRow = [["ses_a", "2099-01-01T00:00:00.000Z"]];
const clockRow = [{ now }] as unknown as unknown[][];
function bindingRow(overrides = {}) {
  const row: Record<string, unknown> = {
    licenseId: "lic_a",
    serverId: "srv_a",
    organizationId: null,
    endpointRevision: 2,
    serverOwnerId: "usr_a",
    tokenDigest: "a".repeat(64),
    tokenIssuedAt: revision,
    tokenExpiresAt: future,
    createdAt: revision,
    updatedAt: revision,
    ...overrides,
  };
  return Object.keys(getTableColumns(licenseRuntimeBindings)).map((key) => row[key]);
}
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.options = [];
});

it("creates high entropy domain-separated tokens without persisting the bearer", () => {
  const first = createLicenseRuntimeToken(),
    second = createLicenseRuntimeToken();
  expect(first.value).toMatch(/^nxlt_[A-Za-z0-9_-]{43}$/u);
  expect(first.value).not.toBe(second.value);
  expect(first.digest).toMatch(/^[a-f0-9]{64}$/u);
  expect(digestLicenseRuntimeToken(first.value)).toBe(first.digest);
  expect(digestLicenseRuntimeToken(` ${first.value}`)).toBeNull();
  expect(digestLicenseRuntimeToken("legacy-secret-key")).toBeNull();
});
it("strictly bounds commands and disallows silent term/model/server changes", () => {
  const command = {
    action: "bind",
    serverId: "srv_a",
    expectedUpdatedAt: revision,
    reason: "Assign this license",
  };
  expect(licenseOwnerCommandSchema.safeParse(command).success).toBe(true);
  for (const extra of [
    { expiresAt: future },
    { status: "active" },
    { model: "unlimited" },
    { serverId: "https://other" },
  ])
    expect(licenseOwnerCommandSchema.safeParse({ ...command, ...extra }).success).toBe(false);
  expect(licenseModerationCommandSchema.safeParse({ ...command, action: "restore" }).success).toBe(
    false,
  );
  expect(
    licenseModerationCommandSchema.safeParse({
      action: "restore",
      expectedUpdatedAt: revision,
      reason: "Restore unchanged term",
    }).success,
  ).toBe(true);
  expect(canModerateLicense("revoked", "restore")).toBe(false);
  expect(canModerateLicense("suspended", "restore")).toBe(true);
});
it("accepts only a newer confirmed license revision and a bounded token", () => {
  const current = new Date(Date.now() + 1000).toISOString();
  const result = {
    license: { id: "lic_a", status: "active", updatedAt: current, serverBound: true },
    token: {
      value: createLicenseRuntimeToken().value,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  };
  expect(confirmedLicenseControl(result, "lic_a", revision, "rotate_token")).toBe(true);
  expect(confirmedLicenseControl(result, "lic_other", revision, "rotate_token")).toBe(false);
  expect(
    confirmedLicenseControl(
      {
        ...result,
        token: {
          ...result.token,
          expiresAt: new Date(
            Date.parse(current) + (LICENSE_RUNTIME_TOKEN_DAYS + 1) * 86400000,
          ).toISOString(),
        },
      },
      "lic_a",
      revision,
      "rotate_token",
    ),
  ).toBe(false);
  expect(confirmedLicenseControl(result, "lic_a", revision, "revoke_token")).toBe(false);
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
it("rejects stale revisions before any token or license mutation", async () => {
  state.results = [[["lic_a", "prd_a", "srv_a", "single_server", "active", future, updated]]];
  await expect(
    repository.ownerCommand({
      ...owner,
      command: { action: "revoke", expectedUpdatedAt: revision, reason: "Revoke this license" },
    }),
  ).rejects.toMatchObject({ code: "LICENSE_CONFLICT" });
  expect(state.queries[0].sql).toContain("for no key update");
  expect(state.queries.every((item) => item.sql.startsWith("select"))).toBe(true);
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
function rotationResults(expiry = future, serverRevision = 2) {
  return [
    [["prd_a", "srv_a", "srv_a"]],
    [["prd_a"]],
    [["srv_a", null]],
    [["srv_a"]],
    [["lic_a", "prd_a", "srv_a", "single_server", "active", expiry, revision]],
    [bindingRow()],
    actorRow,
    sessionRow,
    clockRow,
    [["srv_a", null, serverRevision, "usr_a"]],
    [["lic_a"]],
    [],
    [["lic_a", "active", updated]],
    [],
  ];
}
it("rotates under parent locks, caps expiry to the original license, and stores only a digest", async () => {
  state.results = rotationResults();
  const result = await repository.ownerCommand({
    ...owner,
    tokenDigest: "b".repeat(64),
    command: {
      action: "rotate_token",
      expectedUpdatedAt: revision,
      reason: "Replace server credential",
    },
  });
  expect(result.tokenExpiresAt?.toISOString()).toBe(future);
  expect(state.queries[1].sql).toContain('from "products"');
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain('from "servers"');
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[4].sql).toContain("for no key update");
  const update = state.queries.find((item) =>
    item.sql.startsWith('update "license_runtime_bindings"'),
  );
  expect(update?.params).toContain("b".repeat(64));
  expect(state.queries.find((item) => item.sql.startsWith('update "licenses"'))?.sql).not.toContain(
    '"expires_at" =',
  );
  expect(JSON.stringify(result)).not.toContain("b".repeat(64));
  const session = state.queries.find((item) => item.sql.includes('from "sessions"'));
  expect(session?.sql).toContain("for update");
  expect(session?.params).toContain(digestSessionToken(owner.currentToken));
  expect(session?.params).not.toContain(owner.currentToken);
  expect(session?.params).not.toContain("b".repeat(64));
});
it("caps a runtime token at thirty days even when a historical term is longer", async () => {
  state.results = rotationResults("2027-01-01T00:00:00.000Z");
  const result = await repository.ownerCommand({
    ...owner,
    tokenDigest: "b".repeat(64),
    command: {
      action: "rotate_token",
      expectedUpdatedAt: revision,
      reason: "Replace server credential",
    },
  });
  expect(result.tokenExpiresAt?.getTime()).toBe(Date.parse(now) + 30 * 86400000);
});
it("rejects endpoint revisions changing beneath an existing immutable binding", async () => {
  state.results = rotationResults(future, 3);
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
const releaseCommand = {
  serverId: "srv_a",
  productId: "prd_a",
  buildId: "bld_a",
  sha256Hash: "b".repeat(64),
  nonce: "cc98ca86-5a01-4b7f-b2ac-1eabbeff533f",
};
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

it("rejects missing initiating tokens before opening owner or moderation transactions", async () => {
  const input = {
    ...owner,
    currentToken: "",
    command: {
      action: "revoke" as const,
      expectedUpdatedAt: revision,
      reason: "Revoke this license",
    },
  };
  await expect(repository.ownerCommand(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  await expect(repository.moderate(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(state.queries).toHaveLength(0);
  expect(state.options).toHaveLength(0);
});
