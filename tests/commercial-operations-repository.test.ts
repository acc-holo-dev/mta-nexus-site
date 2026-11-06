import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createCommercialOperationsRepositoryDbMock } = await import(
    "./helpers/commercial-operations-repository-harness"
  );
  return createCommercialOperationsRepositoryDbMock();
});

import { CommercialPlanRepository } from "../packages/db/src/repositories/commercial-plans";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import {
  installCommercialOperationsRepositoryHooks,
  commercialOperationsRepositoryNow as now,
  commercialOperationsRepositoryRoot as root,
  commercialOperationsRepositoryState as state,
  commercialOperationsRepositoryTerms as terms,
} from "./helpers/commercial-operations-repository-harness";

const plans = new CommercialPlanRepository();

installCommercialOperationsRepositoryHooks();

it("public catalog joins exactly the current published revision and projects known terms", async () => {
  state.results = [
    [[21]],
    [["cplan_a", "seller-plan", "user", "published", 2, now, { ...terms, secret: "PRIVATE" }]],
  ];
  const result = await plans.catalog("user", 2);
  expect(result).toMatchObject({
    page: 2,
    total: 21,
    plans: [{ titleEn: terms.titleEn, commissionBps: 750 }],
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(state.options[0]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  const query = state.queries[1];
  expect(query.sql).toContain(
    '"commercial_plan_revisions"."revision" = "commercial_plans"."revision"',
  );
  expect(query.params).toEqual(["user", "published", "published", 20, 20]);
  expect(query.sql).not.toContain("actor_id");
});
it.each(["moderator", "user"])(
  "denies current %s even with a cached administrator session",
  async (role) => {
    state.results = [[root()], [["usr_admin", role]]];
    await expect(
      plans.command({
        currentToken: "plan-admin-token",
        actorId: "usr_admin",
        planId: "cplan_a",
        auditId: "aud_a",
        command: { action: "publish", expectedRevision: 2, reason: "Terms checked" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries[0].sql).toContain("for no key update");
    expect(state.queries[1].sql).toContain("for share");
    expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
  },
);
it("rejects a stale plan revision without altering terms or emitting audit", async () => {
  state.results = [[root()], [["usr_admin", "admin"]], [["ses_admin", "2099-01-01T00:00:00.000Z"]]];
  await expect(
    plans.command({
      currentToken: "plan-admin-token",
      actorId: "usr_admin",
      planId: "cplan_a",
      auditId: "aud_a",
      command: { action: "publish", expectedRevision: 1, reason: "Terms checked" },
    }),
  ).rejects.toMatchObject({ code: "COMMERCIAL_PLAN_CONFLICT" });
  expect(state.queries).toHaveLength(3);
});
it("editing a published plan appends a draft snapshot and audits within its transaction", async () => {
  state.results = [
    [root("published")],
    [["usr_admin", "admin"]],
    [["ses_admin", "2099-01-01T00:00:00.000Z"]],
    [[terms]],
    [],
    [],
    [],
    [["cplan_a", "seller-plan", "user", "draft", 3, now, { ...terms, price: 2000 }]],
    [["ses_admin", "2099-01-01T00:00:00.000Z"]],
  ];
  expect(
    await plans.command({
      currentToken: "plan-admin-token",
      actorId: "usr_admin",
      planId: "cplan_a",
      auditId: "aud_a",
      command: {
        action: "save",
        expectedRevision: 2,
        terms: { ...terms, price: 2000 },
        reason: "Price changed",
      },
    }),
  ).toMatchObject({ plan: { status: "draft", revision: 3, price: 2000 } });
  expect(state.queries[2].sql).toContain('from "sessions"');
  expect(state.queries[2].sql).toContain("for update");
  expect(state.queries[2].params).toContain(digestSessionToken("plan-admin-token"));
  expect(state.queries[2].params).not.toContain("plan-admin-token");
  expect(state.queries[4].sql).toContain('insert into "commercial_plan_revisions"');
  expect(state.queries[4].params).toContain(JSON.stringify({ ...terms, price: 2000 }));
  expect(state.queries[6].params).toContain("commerce.plan_save");
  expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
  expect(state.queries.some((q) => q.sql.startsWith('update "commercial_plan_revisions"'))).toBe(
    false,
  );
});
it("does not publish directly from archive", async () => {
  state.results = [
    [root("archived")],
    [["usr_admin", "admin"]],
    [["ses_admin", "2099-01-01T00:00:00.000Z"]],
  ];
  await expect(
    plans.command({
      currentToken: "plan-admin-token",
      actorId: "usr_admin",
      planId: "cplan_a",
      auditId: "aud_a",
      command: { action: "publish", expectedRevision: 2, reason: "Terms checked" },
    }),
  ).rejects.toMatchObject({ code: "COMMERCIAL_PLAN_STATE_CHANGED" });
  expect(state.queries).toHaveLength(3);
});
