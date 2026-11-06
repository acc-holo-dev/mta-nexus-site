import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createSubscriptionsRepositoryDbMock } = await import(
    "./helpers/subscriptions-repository-harness"
  );
  return createSubscriptionsRepositoryDbMock();
});

import { SubscriptionsRepository } from "../packages/db/src/repositories/subscriptions";
import {
  activation,
  date,
  expiresAt,
  plan,
  terms,
} from "./subscriptions-fixtures";
import {
  subscriptionsRepositoryCurrentToken as currentToken,
  subscriptionsRepositoryGrantValues as grantValues,
  installSubscriptionsRepositoryHooks,
  subscriptionsRepositoryMutationHead as mutationHead,
  subscriptionsRepositoryPlanValues as planValues,
  subscriptionsRepositoryReceiptValues as receiptValues,
  subscriptionsRepositorySessionRow as sessionRow,
  subscriptionsRepositoryState as state,
  subscriptionsRepositoryWrites as writes,
} from "./helpers/subscriptions-repository-harness";

const repo = new SubscriptionsRepository();

installSubscriptionsRepositoryHooks();

it("activates with stable request/account locks and database-generated terms and dates", async () => {
  state.rows = [
    ...mutationHead(),
    [planValues()],
    [[terms, "published"]],
    [],
    sessionRow(),
    [[date.toISOString()]],
    [[0]],
    [grantValues()],
    [receiptValues()],
    [],
    sessionRow(),
  ];
  const result = await repo.command("usr_a", activation, currentToken);
  expect(result.replayed).toBe(false);
  expect(result.receipt.subscription.terms).toEqual(terms);
  expect(state.options).toEqual([{ isolationLevel: "read committed" }]);
  expect(state.queries.filter((q) => q.sql.includes("pg_advisory_xact_lock"))).toHaveLength(2);
  const sessionQuery = state.queries.find((q) => q.sql.includes('from "sessions"'));
  expect(sessionQuery?.sql).toContain("for update");
  expect(sessionQuery?.params).toContain(createHash("sha256").update(currentToken).digest("hex"));
  expect(sessionQuery?.params).not.toContain(currentToken);
  const subscriptionLock = state.queries.findIndex(
    (q) => q.sql.includes('from "account_subscriptions"') && q.sql.includes("for update"),
  );
  const sessionLock = state.queries.findIndex((q) => q.sql.includes('from "sessions"'));
  expect(sessionLock).toBeGreaterThan(subscriptionLock);
  expect(sessionLock).toBeLessThan(
    state.queries.findIndex((q) => /^(?:insert|update|delete)/u.test(q.sql)),
  );
  expect(writes()).toHaveLength(3);
  expect(writes()[0]?.sql).toContain('"account_subscriptions"');
  expect(writes()[0]?.params).not.toContain(JSON.stringify(terms));
  expect(writes()[2]?.params).toContain("commerce.subscription_activated_free");
  expect(
    state.queries.some((q) => /payments|licenses|ledger_entries|entitlements/u.test(q.sql)),
  ).toBe(false);
});
it("rejects an absent initiating token without opening a transaction", async () => {
  await expect(repo.command("usr_a", activation, "")).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(state.options).toEqual([]);
  expect(state.queries).toEqual([]);
});
it("replays an exact request without requiring the plan to remain published", async () => {
  state.rows = [[], [], [], [], [["usr_a"]], [receiptValues()], sessionRow()];
  expect((await repo.command("usr_a", activation, currentToken)).replayed).toBe(true);
  expect(writes()).toHaveLength(0);
  expect(state.queries.some((q) => q.sql.includes('from "commercial_plans"'))).toBe(false);
});
it("rejects reused requests with changed plan revisions", async () => {
  state.rows = [[], [], [], [], [["usr_a"]], [receiptValues()], sessionRow()];
  await expect(
    repo.command("usr_a", { ...activation, expectedRevision: 3 }, currentToken),
  ).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUEST_CONFLICT" });
  expect(writes()).toHaveLength(0);
});
it("rejects paid terms before reading or modifying any subscription", async () => {
  state.rows = [...mutationHead(), [planValues()], [[{ ...terms, price: 1000 }, "published"]]];
  await expect(repo.command("usr_a", activation, currentToken)).rejects.toMatchObject({
    code: "SUBSCRIPTION_PAYMENT_REQUIRED",
  });
  expect(writes()).toHaveLength(0);
});
it("refuses stale plan versions and a mismatched account scope", async () => {
  for (const changed of [
    { ...plan, revision: 3 },
    { ...plan, scope: "organization" as const },
  ]) {
    state.rows = [...mutationHead(), [planValues(changed as typeof plan)]];
    await expect(repo.command("usr_a", activation, currentToken)).rejects.toMatchObject({
      code: "SUBSCRIPTION_PLAN_CHANGED",
    });
  }
  expect(writes()).toHaveLength(0);
});
it("does not allow overlapping active periods", async () => {
  state.rows = [
    ...mutationHead(),
    [planValues()],
    [[terms, "published"]],
    [grantValues()],
    sessionRow(),
    [[date.toISOString()]],
  ];
  await expect(repo.command("usr_a", activation, currentToken)).rejects.toMatchObject({
    code: "SUBSCRIPTION_ALREADY_ACTIVE",
  });
  expect(writes()).toHaveLength(0);
});
it("retires an expired row before creating a new period and records expiry atomically", async () => {
  state.rows = [
    ...mutationHead(),
    [planValues()],
    [[terms, "published"]],
    [grantValues()],
    sessionRow(),
    [[expiresAt.toISOString()]],
    [],
    [],
    [[1]],
    [grantValues()],
    [receiptValues()],
    [],
    sessionRow(),
  ];
  expect((await repo.command("usr_a", activation, currentToken)).replayed).toBe(false);
  expect(writes()[0]?.sql).toContain('update "account_subscriptions"');
  expect(writes()[0]?.params).toContain("expired");
  expect(writes()[1]?.params).toContain("commerce.subscription_expired");
  expect(writes()).toHaveLength(5);
});
it("enforces the bounded period quota while leaving cancellation independent", async () => {
  state.rows = [
    ...mutationHead(),
    [planValues()],
    [[terms, "published"]],
    [],
    sessionRow(),
    [[date.toISOString()]],
    [[500]],
  ];
  await expect(repo.command("usr_a", activation, currentToken)).rejects.toMatchObject({
    code: "SUBSCRIPTION_LIMIT",
  });
  expect(writes()).toHaveLength(0);
});
it("checks live financial authority before reading retry receipts", async () => {
  state.rows = [
    [],
    [],
    [],
    [],
    [["org_a", "usr_other", "Organization"]],
    [["usr_a"]],
    [["developer"]],
  ];
  await expect(
    repo.command("usr_a", { ...activation, organizationId: "org_a" }, currentToken),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries.some((q) => q.sql.includes('from "subscription_receipts"'))).toBe(false);
});
