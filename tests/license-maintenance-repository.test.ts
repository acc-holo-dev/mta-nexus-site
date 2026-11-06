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
import {
  installLicenseMaintenanceRepositoryHooks,
  licenseMaintenanceRepositoryClock as clock,
  licenseMaintenanceRepositoryFuture as future,
  licenseMaintenanceRepositoryPast as past,
  licenseMaintenanceRepositoryState as state,
} from "./helpers/license-maintenance-repository-harness";

const repo = new LicenseMaintenanceRepository();

installLicenseMaintenanceRepositoryHooks();

it("takes an expired finite parent with skip-locked, revokes its token, and records one atomic event and inbox notice", async () => {
  state.results = [
    [],
    [],
    [["lic_a", "usr_a", "active", past]],
    clock(true),
    [],
    [],
    [],
    [[true]],
    [],
    [],
    [],
  ];
  expect(await repo.runBatch(1)).toEqual({
    processed: 1,
    expired: 1,
    warned: 0,
    inbox: 1,
    pushJobs: 2,
  });
  const selection = state.queries[2];
  for (const fragment of [
    "isfinite",
    "not exists",
    "license_term_events",
    "for no key update skip locked",
  ])
    expect(selection.sql.toLowerCase()).toContain(fragment);
  expect(selection.params.at(-1)).toBe(1);
  expect(state.queries.find((q) => q.sql.startsWith('update "licenses"'))?.params).toContain(
    "expired",
  );
  const tokens = state.queries.find((q) => q.sql.startsWith('update "license_runtime_bindings"'));
  for (const field of ["token_digest", "token_issued_at", "token_expires_at"])
    expect(tokens?.sql).toContain(`"${field}" =`);
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "license_term_events"'))?.sql,
  ).toContain('(select "licenses"."expires_at"');
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "audit_events"'))?.params,
  ).toContain("license.expired");
  expect(
    state.queries
      .filter((q) => q.sql.startsWith('update "licenses"'))
      .every((q) => !q.sql.includes('"expires_at" =')),
  ).toBe(true);
  expect(
    state.queries.every(
      (q) => !/^insert into "(payments|orders|ledger_entries|entitlements)"/u.test(q.sql),
    ),
  ).toBe(true);
});
it("warns once without mutating license, binding or original expiry", async () => {
  state.results = [
    [],
    [],
    [["lic_a", "usr_a", "active", future]],
    clock(false),
    [],
    [],
    [],
    [],
    [],
  ];
  expect(await repo.runBatch(1)).toMatchObject({ warned: 1, expired: 0, inbox: 1 });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "license_term_events"'))?.params,
  ).toContain("expiring");
});
it("records opted-out processing without inbox/push and retains the suppression decision", async () => {
  state.results = [
    [],
    [],
    [["lic_a", "usr_a", "suspended", past]],
    clock(true),
    [],
    [],
    [],
    [[false]],
    [],
    [],
  ];
  expect(await repo.runBatch(1)).toMatchObject({ expired: 1, inbox: 0, pushJobs: 0 });
  expect(state.push).not.toHaveBeenCalled();
  expect(state.queries.some((q) => q.sql.startsWith('insert into "notifications"'))).toBe(false);
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "license_term_events"'))?.params,
  ).toContain(false);
});
it("preserves inbox processing on optional push failure but propagates intent failure", async () => {
  state.results = [
    [],
    [],
    [["lic_a", "usr_a", "expired", past]],
    clock(true),
    [],
    [],
    [[true]],
    [],
    [],
    [],
  ];
  state.push.mockResolvedValue({ queued: 0, reason: "error" });
  const pending = [...state.results];
  expect(await repo.runBatch(1)).toMatchObject({ expired: 1, inbox: 1, pushJobs: 0 });
  expect(state.queries.some((q) => q.sql.startsWith('update "licenses"'))).toBe(false);
  state.results = pending;
  state.push.mockRejectedValue(new Error("Admission intent failed"));
  await expect(repo.runBatch(1)).rejects.toThrow("Admission intent failed");
});
it("bounds mutation work and does nothing for an empty queue or an aborted batch", async () => {
  for (const limit of [0, 101, 1.5, Number.NaN])
    await expect(repo.runBatch(limit)).rejects.toThrow();
  const abort = new AbortController();
  abort.abort();
  expect(await repo.runBatch(20, abort.signal)).toMatchObject({ processed: 0 });
  expect(state.queries).toHaveLength(0);
  state.results = [[], [], []];
  expect(await repo.runBatch()).toMatchObject({ processed: 0 });
  expect(state.queries).toHaveLength(3);
});
