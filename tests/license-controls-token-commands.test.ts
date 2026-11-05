import { canModerateLicense, LICENSE_RUNTIME_TOKEN_DAYS } from "@nexus/domain";
import { createLicenseRuntimeToken, digestLicenseRuntimeToken } from "@nexus/security";
import { licenseModerationCommandSchema, licenseOwnerCommandSchema } from "@nexus/validation";
import { beforeEach, expect, it, vi } from "vitest";
import { confirmedLicenseControl } from "../apps/web/src/lib/license-control-confirmation";

vi.mock("../packages/db/src/client", async () => {
  const { createLicenseControlsDbMock } = await import("./helpers/license-controls-harness");
  return createLicenseControlsDbMock();
});

import { LicenseControlsRepository } from "../packages/db/src/repositories/license-controls";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import {
  future,
  now,
  owner,
  resetLicenseControlsState,
  revision,
  rotationResults,
  licenseControlsState as state,
  updated,
} from "./helpers/license-controls-harness";

const repository = new LicenseControlsRepository();

beforeEach(() => {
  resetLicenseControlsState();
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
