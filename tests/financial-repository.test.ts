import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createFinancialRepositoryDbMock } = await import(
    "./helpers/financial-repository-harness"
  );
  return createFinancialRepositoryDbMock();
});

import { LedgerRepository } from "../packages/db/src/repositories/ledger";
import {
  financialRepositoryDigest as digest,
  financialRepositoryLines as lines,
  financialRepositoryRecord as record,
  financialRepositoryState as state,
  installFinancialRepositoryHooks,
} from "./helpers/financial-repository-harness";

const ledger = new LedgerRepository();
installFinancialRepositoryHooks();

it("serializes references before account locks and posts the whole batch atomically", async () => {
  state.results = [[], [], [], [], [], [], [record(lines[0], 90)], [record(lines[1], -90)]];
  expect(await ledger.post("post_a", lines)).toMatchObject([
    { balanceAfter: 90 },
    { balanceAfter: -90 },
  ]);
  expect(state.queries[2].sql).toContain('from "orders"');
  expect(state.queries[2].sql).toContain("for no key update");
  expect(state.queries[3].params).toEqual(["ledger-account:platform:nexus:USD"]);
  expect(state.queries[4].params).toEqual(["ledger-account:user:usr_a:USD"]);
  expect(state.queries[5].sql).toContain('insert into "ledger_posting_batches"');
  expect(state.queries.map((q) => q.sql).join("\n")).not.toMatch(
    /update "(?:orders|payments|entitlements)"/u,
  );
});
it("exact replay returns existing records without a second posting", async () => {
  state.results = [[], [[digest()]], [record(lines[0], 90), record(lines[1], -90)]];
  expect(await ledger.post("post_a", [...lines].reverse())).toHaveLength(2);
  expect(state.queries).toHaveLength(3);
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("rejects key reuse with changed contents", async () => {
  state.results = [[], [["different"]]];
  await expect(ledger.post("post_a", lines)).rejects.toMatchObject({
    code: "LEDGER_REQUEST_CONFLICT",
  });
  expect(state.queries).toHaveLength(2);
});
it("a cancelled order cannot acquire journal references", async () => {
  state.results = [[], [], [["ref_a", "cancelled"]]];
  await expect(ledger.post("post_a", lines)).rejects.toMatchObject({ code: "ORDER_NOT_PAYABLE" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("refuses unbalanced input before opening a transaction", async () => {
  await expect(
    ledger.post("post_a", [lines[0], { ...lines[1], amount: -80 }]),
  ).rejects.toMatchObject({ code: "LEDGER_POSTING_INVALID" });
  expect(state.queries).toHaveLength(0);
});
it("sums only the requested account and currency", async () => {
  state.results = [[["90"]]];
  expect(await ledger.getAccountBalance("user:usr_a", "EUR")).toBe(90);
  expect(state.queries[0].params).toEqual(["user:usr_a", "EUR"]);
  expect(state.queries[0].sql).toContain("sum(");
});
