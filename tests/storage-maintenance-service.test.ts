import { ForbiddenError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  admin: vi.fn(),
  retire: vi.fn(),
  finish: vi.fn(),
  observe: vi.fn(),
  discover: vi.fn(),
  remove: vi.fn(),
  provider: {} as Record<string, unknown>,
}));
vi.mock("@nexus/db", () => ({
  storageMaintenanceRepository: {
    assertAdmin: state.admin,
    retire: state.retire,
    finish: state.finish,
    observe: state.observe,
    list: vi.fn(),
    detail: vi.fn(),
  },
}));
vi.mock("@nexus/storage", () => ({ getStorageProvider: () => state.provider }));

import { storageMaintenanceService as service } from "../apps/web/src/lib/services/storage-maintenance-service";

beforeEach(() => {
  vi.clearAllMocks();
  state.provider = {
    discoverAssetNamespace: state.discover,
    removeMaintenanceObject: state.remove,
  };
  state.admin.mockResolvedValue(undefined);
  state.retire.mockResolvedValue({
    terminal: false,
    leaseToken: "lease",
    identity: { key: "asset" },
  });
  state.finish.mockImplementation(async (_actor, _id, _lease, state) => ({ state }));
  state.remove.mockResolvedValue("deleted");
  state.discover.mockResolvedValue({ objects: [], skipped: 2, nextOffset: null, limited: false });
  state.observe.mockResolvedValue({ observed: 0 });
});
it("checks the live role before any provider or retirement operation", async () => {
  state.admin.mockRejectedValue(new ForbiddenError());
  await expect(service.cleanup("usr_a", "smo_a", 1)).rejects.toMatchObject({ statusCode: 403 });
  expect(state.retire).not.toHaveBeenCalled();
  expect(state.remove).not.toHaveBeenCalled();
});
it("commits retirement before touching filesystem bytes", async () => {
  await service.cleanup("usr_a", "smo_a", 1);
  expect(state.retire.mock.invocationCallOrder[0]).toBeLessThan(
    state.remove.mock.invocationCallOrder[0] ?? 0,
  );
  expect(state.remove.mock.invocationCallOrder[0]).toBeLessThan(
    state.finish.mock.invocationCallOrder[0] ?? 0,
  );
  expect(state.finish).toHaveBeenCalledWith("usr_a", "smo_a", "lease", "deleted");
});
it("does not delete after a refused or uncertain retirement", async () => {
  state.retire.mockRejectedValue(new Error("commit unknown"));
  await expect(service.cleanup("usr_a", "smo_a", 1)).rejects.toThrow();
  expect(state.remove).not.toHaveBeenCalled();
});
it.each(["missing", "changed"])(
  "records %s without translating it into successful deletion",
  async (outcome) => {
    state.remove.mockResolvedValue(outcome);
    expect(await service.cleanup("usr_a", "smo_a", 1)).toEqual({ state: outcome });
  },
);
it("records a retryable failure without exposing filesystem errors", async () => {
  state.remove.mockRejectedValue(new Error("private /root/storage"));
  expect(await service.cleanup("usr_a", "smo_a", 1)).toEqual({ state: "failed" });
});
it("propagates uncertainty when recording the outcome fails", async () => {
  state.finish.mockRejectedValue(new Error("DB transport"));
  await expect(service.cleanup("usr_a", "smo_a", 1)).rejects.toThrow("DB transport");
  expect(state.remove).toHaveBeenCalledTimes(1);
});
it("returns a terminal result idempotently without deleting again", async () => {
  state.retire.mockResolvedValue({ terminal: true, state: "deleted" });
  expect(await service.cleanup("usr_a", "smo_a", 1)).toEqual({ state: "deleted" });
  expect(state.remove).not.toHaveBeenCalled();
});
it("fails closed for an unsupported adapter before retirement", async () => {
  state.provider = {};
  await expect(service.cleanup("usr_a", "smo_a", 1)).rejects.toMatchObject({
    code: "STORAGE_MAINTENANCE_UNSUPPORTED",
  });
  expect(state.retire).not.toHaveBeenCalled();
});
it("persists provider observations only after an actual bounded discovery", async () => {
  expect(await service.discover("usr_a", "usr_b", 0)).toEqual({
    observed: 0,
    skipped: 2,
    nextOffset: null,
    limited: false,
  });
  expect(state.observe).toHaveBeenCalledWith("usr_a", []);
  expect(state.discover.mock.invocationCallOrder[0]).toBeLessThan(
    state.observe.mock.invocationCallOrder[0] ?? 0,
  );
});
