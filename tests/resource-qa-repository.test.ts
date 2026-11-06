import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  notices: [] as unknown[],
}));

vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

vi.mock("../packages/db/src/repositories/resource-qa-notice", () => ({
  notifyResourceQaEvent: async (_tx: unknown, input: unknown) => {
    state.notices.push(input);
  },
}));

import { resourceQaRepository as repo } from "../packages/db/src/repositories/resource-qa";

const product = ["prd_a", "Resource", "resource", "published", 0, "usr_publisher", null];

beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.notices = [];
});

it("asks on a free public resource without writing reviews or release watches", async () => {
  state.rows = [[product], [["bld_safe"]], [], [], []];
  const result = await repo.ask({
    actorId: "usr_a",
    productId: "prd_a",
    threadId: "rqt_a",
    auditId: "aud_a",
    command: { action: "ask", body: "How do I enable the module?" },
  });
  expect(result).toMatchObject({ id: "rqt_a", revision: 1, status: "open" });
  expect(state.queries.some((q) => q.sql.includes('insert into "resource_qa_threads"'))).toBe(true);
  expect(
    state.queries.some((q) => q.sql.includes('insert into "resource_qa_thread_follows"')),
  ).toBe(true);
  expect(state.queries.some((q) => q.sql.includes('insert into "comments"'))).toBe(false);
  expect(state.queries.some((q) => q.sql.includes("resource_release_watches"))).toBe(false);
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "audit_events"'))?.params,
  ).not.toContain("How do I enable the module?");
  expect(state.notices).toEqual([
    expect.objectContaining({ kind: "asked", threadId: "rqt_a", actorId: "usr_a" }),
  ]);
});

it("requires acquired access before asking about a paid public resource", async () => {
  const paid = ["prd_a", "Resource", "resource", "published", 500, "usr_publisher", null];
  state.rows = [[paid], [["bld_safe"]], [], [], [["user"]]];
  await expect(
    repo.ask({
      actorId: "usr_a",
      productId: "prd_a",
      threadId: "rqt_a",
      auditId: "aud_a",
      command: { action: "ask", body: "Does the paid pack include maps?" },
    }),
  ).rejects.toMatchObject({ code: "RESOURCE_QA_ACCESS_REQUIRED" });
  expect(state.queries.some((q) => q.sql.includes('insert into "resource_qa_threads"'))).toBe(
    false,
  );
});

it("stores optional published build context without download fields", async () => {
  state.rows = [[product], [["bld_safe"]], [["bld_a", "1.2.0"]], [], [], []];
  const result = await repo.ask({
    actorId: "usr_a",
    productId: "prd_a",
    threadId: "rqt_a",
    auditId: "aud_a",
    command: { action: "ask", body: "Is 1.2.0 compatible with MTA 1.6?", buildId: "bld_a" },
  });
  expect(result.buildContext).toEqual({ version: "1.2.0", available: true });
  const insert = state.queries.find((q) => q.sql.includes('insert into "resource_qa_threads"'));
  expect(insert?.params).toContain("bld_a");
  expect(insert?.params).toContain("1.2.0");
  expect(insert?.sql).not.toContain("storage_key");
});

it("lets managers answer and resolve without rating aggregates", async () => {
  state.rows = [
    [product],
    [["bld_safe"]],
    [["admin"]],
    [["rqt_a", "open", 1]],
    [],
    [["admin"]],
    [],
  ];
  const answered = await repo.answer({
    actorId: "usr_publisher",
    productId: "prd_a",
    threadId: "rqt_a",
    answerId: "rqa_a",
    auditId: "aud_b",
    command: {
      action: "answer",
      body: "Enable it in meta.xml and restart the resource.",
      expectedThreadRevision: 1,
    },
  });
  expect(answered).toMatchObject({
    threadId: "rqt_a",
    answerId: "rqa_a",
    threadRevision: 2,
  });
  expect(
    state.queries.some((q) => q.sql.includes("rating_average") || q.sql.includes("rating_count")),
  ).toBe(false);
  expect(state.notices).toEqual([
    expect.objectContaining({
      kind: "answered",
      threadId: "rqt_a",
      answerId: "rqa_a",
      actorId: "usr_publisher",
    }),
  ]);

  state.queries = [];
  state.notices = [];
  state.rows = [
    [product],
    [["bld_safe"]],
    [["admin"]],
    [["rqt_a", "open", 2, null]],
    [["admin"]],
    [["rqa_a", "published"]],
    [],
  ];
  const resolved = await repo.resolve({
    actorId: "usr_publisher",
    productId: "prd_a",
    threadId: "rqt_a",
    auditId: "aud_c",
    command: { action: "resolve", answerId: "rqa_a", expectedRevision: 2 },
  });
  expect(resolved).toMatchObject({
    status: "resolved",
    resolvedAnswerId: "rqa_a",
    revision: 3,
  });
  expect(state.notices).toEqual([
    expect.objectContaining({ kind: "resolved", threadId: "rqt_a", answerId: "rqa_a" }),
  ]);
});

it("lets managers remove a thread and clear public visibility", async () => {
  state.rows = [[product], [["bld_safe"]], [["admin"]], [["rqt_a", "open", 2]], [["admin"]], []];
  const removed = await repo.removeThread({
    actorId: "usr_publisher",
    productId: "prd_a",
    threadId: "rqt_a",
    auditId: "aud_remove",
    command: { action: "remove", expectedRevision: 2 },
  });
  expect(removed).toMatchObject({ threadId: "rqt_a", status: "removed", revision: 3 });
  expect(state.queries.some((q) => q.sql.includes('update "resource_qa_threads"'))).toBe(true);
  expect(state.notices).toEqual([
    expect.objectContaining({ kind: "removed", threadId: "rqt_a", actorId: "usr_publisher" }),
  ]);
});

it("lets managers remove an answer and reopen when it was the useful reply", async () => {
  state.rows = [
    [product],
    [["bld_safe"]],
    [["admin"]],
    [["rqt_a", "resolved", 4, "rqa_a"]],
    [["rqa_a", "published", 1]],
    [["admin"]],
    [],
  ];
  const removed = await repo.removeAnswer({
    actorId: "usr_publisher",
    productId: "prd_a",
    threadId: "rqt_a",
    answerId: "rqa_a",
    auditId: "aud_answer_remove",
    command: { action: "remove", expectedRevision: 4 },
  });
  expect(removed).toMatchObject({
    threadId: "rqt_a",
    answerId: "rqa_a",
    status: "open",
    threadRevision: 5,
  });
  expect(state.queries.some((q) => q.sql.includes('update "resource_qa_answers"'))).toBe(true);
});

it("keeps thread follow separate from release watches", async () => {
  state.rows = [[product], [["bld_safe"]], [["rqt_a", "open"]], [], []];
  const result = await repo.follow({
    actorId: "usr_a",
    productId: "prd_a",
    threadId: "rqt_a",
    auditId: "aud_d",
    command: { action: "follow", expectedRevision: 0 },
  });
  expect(result).toMatchObject({ following: true, revision: 1, replayed: false });
  expect(
    state.queries.some((q) => q.sql.includes('insert into "resource_qa_thread_follows"')),
  ).toBe(true);
  expect(state.queries.some((q) => q.sql.includes("resource_release_watches"))).toBe(false);
  expect(state.queries.some((q) => q.sql.includes('insert into "follows"'))).toBe(false);
  const audit = state.queries.find((q) => q.sql.startsWith('insert into "audit_events"'));
  const details = String(
    audit?.params.find((value) => typeof value === "string" && value.includes("releaseWatch")),
  );
  expect(details).toContain('"releaseWatch":false');
  expect(details).toContain('"productBookmark":false');
});
