import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLicenseMaintenanceRepositoryDbMock } = await import(
    "./helpers/license-maintenance-repository-harness"
  );
  return createLicenseMaintenanceRepositoryDbMock();
});
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { licenseMaintenanceRepositoryState } = await import(
    "./helpers/license-maintenance-repository-harness"
  );
  return {
    enqueueWebPushWithRecoveryWithin: licenseMaintenanceRepositoryState.push,
  };
});

import { LicenseMaintenanceRepository } from "../packages/db/src/repositories/license-maintenance";
import { LicenseRepository } from "../packages/db/src/repositories/licenses";
import {
  installLicenseMaintenanceRepositoryHooks,
  licenseMaintenanceRepositoryNow as now,
  licenseMaintenanceRepositoryPast as past,
  licenseMaintenanceRepositoryState as state,
} from "./helpers/license-maintenance-repository-harness";

const repo = new LicenseMaintenanceRepository();

installLicenseMaintenanceRepositoryHooks();

it("requires current admin authority before exposing the maintenance queue", async () => {
  state.results = [[["moderator"]]];
  await expect(repo.preview("usr_a")).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain("for share");
});
it("paginates operator metadata without keys, recipients, token digests or endpoint addresses", async () => {
  state.results = [
    [["admin"]],
    [[41, 30, 11]],
    [[5]],
    [["lic_a", "Resource", "active", past, "expired"]],
  ];
  expect(await repo.preview("usr_a", 2)).toMatchObject({
    page: 2,
    expired: 30,
    expiring: 11,
    unknownTerms: 5,
  });
  const query = state.queries.at(-1);
  for (const field of ['"key"', '"user_id"', '"token_digest"', '"ip_address"'])
    expect(query?.sql).not.toContain(field);
  expect(query?.params.slice(-2)).toEqual([20, 20]);
});
it("filters the buyer archive with current effective expiry, durable bindings and literal search", async () => {
  state.results = [
    [[41]],
    [["lic_a", "Resource", "active", "expired", "single_server", past, now, true]],
  ];
  const result = await new LicenseRepository().pageUserHistory("usr_a", 2, {
    status: "expired",
    binding: "bound",
    term: "finite",
    sort: "expires_soon",
    q: "100%_",
  });
  expect(result).toMatchObject({
    page: 2,
    licenses: [{ effectiveStatus: "expired", serverBound: true }],
  });
  const query = state.queries.at(-1);
  expect(query?.params).toEqual(expect.arrayContaining(["usr_a", "expired", "%100\\%\\_%", 20]));
  for (const fragment of [
    "clock_timestamp",
    "isfinite",
    "license_runtime_bindings",
    "asc nulls last",
  ])
    expect(query?.sql).toContain(fragment);
  for (const field of ['"licenses"."key"', '"token_digest"', '"entitlements"'])
    expect(query?.sql).not.toContain(field);
});
