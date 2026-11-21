import { expect, it } from "vitest";
import { confirmedWalletAdminBatch } from "../../src/features/commerce/wallet-admin-batch-confirmation";

it("accepts integer count batches for the expected actor", () => {
  expect(
    confirmedWalletAdminBatch({ count: 3, actorId: "usr_a", released: [{ id: "h1" }] }, "usr_a"),
  ).toEqual({ count: 3, actorId: "usr_a" });
  expect(confirmedWalletAdminBatch({ count: 0, actorId: "usr_a" }, "usr_a")).toEqual({
    count: 0,
    actorId: "usr_a",
  });
});

it("rejects mismatched actors and unsafe counts", () => {
  expect(confirmedWalletAdminBatch({ count: 1, actorId: "usr_b" }, "usr_a")).toBeNull();
  expect(confirmedWalletAdminBatch({ count: 1.5, actorId: "usr_a" }, "usr_a")).toBeNull();
  expect(confirmedWalletAdminBatch({ count: -1, actorId: "usr_a" }, "usr_a")).toBeNull();
  expect(confirmedWalletAdminBatch({ actorId: "usr_a" }, "usr_a")).toBeNull();
  expect(confirmedWalletAdminBatch(null, "usr_a")).toBeNull();
});
