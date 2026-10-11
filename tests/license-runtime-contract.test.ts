import { expect, it } from "vitest";
import { licenseOwnerCommandSchema, licenseReleaseCheckSchema } from "@nexus/validation";
import { confirmedLicenseControl } from "../apps/web/src/lib/license-control-confirmation";
import { licenseRuntimePage } from "../apps/web/src/lib/license-runtime-query";
import {
  confirmLicenseRelease,
  parseLicenseRuntimeContext,
} from "../apps/web/src/lib/license-runtime-response";

const checkedAt = "2026-10-11T01:00:00.000Z";
const command = {
  serverId: "srv_a",
  productId: "prd_a",
  buildId: "bld_a",
  sha256Hash: "a".repeat(64),
  nonce: "cc98ca86-5a01-4b7f-b2ac-1eabbeff533f",
};
const confirmation = {
  ...command,
  valid: true,
  licenseId: "lic_a",
  version: "1.0",
  checkedAt,
  expiresAt: "2026-10-20T01:00:00.000Z",
  leaseExpiresAt: "2026-10-11T01:01:00.000Z",
  recheckAfterSeconds: 30,
};

it("requires both observed revisions for recovery and never accepts a replacement server or expiry", () => {
  const recovery = {
    action: "refresh_binding",
    expectedUpdatedAt: checkedAt,
    expectedEndpointRevision: 3,
    reason: "Reconfirm this same server",
  };
  expect(licenseOwnerCommandSchema.parse(recovery)).toEqual(recovery);
  for (const extra of [
    { expectedEndpointRevision: undefined },
    { expectedEndpointRevision: -1 },
    { expectedEndpointRevision: 1.5 },
    { expectedEndpointRevision: 2147483648 },
    { serverId: "srv_other" },
    { expiresAt: checkedAt },
    { serverOwnerId: "usr_other" },
  ])
    expect(licenseOwnerCommandSchema.safeParse({ ...recovery, ...extra }).success).toBe(false);
});
it("strictly identifies the release and bounds the caller nonce", () => {
  expect(licenseReleaseCheckSchema.parse(command)).toEqual(command);
  for (const extra of [
    { nonce: "replayed-arbitrary-string" },
    { buildId: "https://other/file" },
    { sha256Hash: "A".repeat(64) },
    { productId: "" },
    { token: "secret" },
    { expiresAt: checkedAt },
  ])
    expect(licenseReleaseCheckSchema.safeParse({ ...command, ...extra }).success).toBe(false);
});
it("accepts an acknowledgement only for the exact server, resource, release, hash and request nonce", () => {
  expect(confirmLicenseRelease(confirmation, command, "lic_a", "1.0", Date.parse(checkedAt))).toBe(
    true,
  );
  for (const extra of [
    { valid: false },
    { licenseId: "lic_other" },
    { version: "2.0" },
    { serverId: "srv_other" },
    { productId: "prd_other" },
    { buildId: "bld_other" },
    { sha256Hash: "b".repeat(64) },
    { nonce: "41d541aa-c1e9-4d63-8314-36173297b300" },
  ])
    expect(
      confirmLicenseRelease(
        { ...confirmation, ...extra },
        command,
        "lic_a",
        "1.0",
        Date.parse(checkedAt),
      ),
    ).toBe(false);
});
it("fails closed on expired, overly long, future, noncanonical or replayed acknowledgements", () => {
  for (const extra of [
    { leaseExpiresAt: checkedAt },
    { leaseExpiresAt: "2026-10-11T01:01:00.001Z" },
    { expiresAt: checkedAt },
    { checkedAt: "2026-10-11T01:00:16.000Z" },
    { checkedAt: "2026-10-11T00:58:59.000Z" },
    { checkedAt: "2026-10-11 01:00:00" },
    { recheckAfterSeconds: 31 },
    { recheckAfterSeconds: 0 },
    { recheckAfterSeconds: 1.5 },
  ])
    expect(
      confirmLicenseRelease(
        { ...confirmation, ...extra },
        command,
        "lic_a",
        "1.0",
        Date.parse(checkedAt),
      ),
    ).toBe(false);
  expect(
    confirmLicenseRelease(
      confirmation,
      command,
      "lic_a",
      "1.0",
      Date.parse(confirmation.leaseExpiresAt),
    ),
  ).toBe(false);
});
it("projects only safe runtime configuration fields and rejects duplicate or malformed releases", () => {
  const context = {
    licenseId: "lic_a",
    productId: "prd_a",
    serverId: "srv_a",
    page: 1,
    pageSize: 20,
    totalPages: 1,
    total: 1,
    items: [{ id: "bld_a", version: "1.0", sha256Hash: command.sha256Hash, storageKey: "PRIVATE" }],
    tokenDigest: "PRIVATE",
    ownerId: "PRIVATE",
  };
  expect(JSON.stringify(parseLicenseRuntimeContext(context, "lic_a"))).not.toContain("PRIVATE");
  for (const extra of [
    { licenseId: "lic_other" },
    { page: 0 },
    { pageSize: 100 },
    { totalPages: 0 },
    { items: [...context.items, ...context.items] },
    { items: [{ ...context.items[0], sha256Hash: "invalid" }] },
  ])
    expect(parseLicenseRuntimeContext({ ...context, ...extra }, "lic_a")).toBeNull();
});
it("bounds all private pagination and rejects ambiguous or unexpected filters", () => {
  expect(licenseRuntimePage(new URLSearchParams())).toBe(1);
  expect(licenseRuntimePage(new URLSearchParams("page=9999"))).toBe(9999);
  for (const query of [
    "page=0",
    "page=01",
    "page=10000",
    "page=1&page=2",
    "page=1&userId=usr_other",
    "page=-1",
  ])
    expect(() => licenseRuntimePage(new URLSearchParams(query))).toThrow();
});
it("requires recovery to confirm the observed endpoint and credential invalidation", () => {
  const result = {
    license: {
      id: "lic_a",
      status: "active",
      serverBound: true,
      updatedAt: "2026-10-11T01:00:00.001Z",
    },
    binding: { endpointRevision: 3, tokenRevoked: true },
  };
  expect(confirmedLicenseControl(result, "lic_a", checkedAt, "refresh_binding", 3)).toBe(true);
  for (const binding of [
    { endpointRevision: 2, tokenRevoked: true },
    { endpointRevision: 3, tokenRevoked: false },
  ])
    expect(
      confirmedLicenseControl({ ...result, binding }, "lic_a", checkedAt, "refresh_binding", 3),
    ).toBe(false);
  expect(
    confirmedLicenseControl(
      { ...result, token: { value: "secret" } },
      "lic_a",
      checkedAt,
      "refresh_binding",
      3,
    ),
  ).toBe(false);
});
