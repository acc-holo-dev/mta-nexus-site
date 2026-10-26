import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
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
import { resourceBuildWorkspaceRepository as repo } from "../packages/db/src/repositories/resource-build-workspace";
const parent = ["prd_a", "Resource", "resource", "published", "usr_a", null];
function build(status = "pending_review", revision = 3, notes: string | null = null) {
  return [
    "bld_a",
    "prd_a",
    "1.0.0",
    status,
    revision,
    notes,
    null,
    "resource.zip",
    42,
    "a".repeat(64),
    "clean",
    "scanner",
    "2026-10-11T00:00:00Z",
    false,
    "2026-10-11T00:00:00Z",
  ];
}
const input = {
  productId: "prd_a",
  buildId: "bld_a",
  actorId: "usr_a",
  auditId: "aud_a",
  command: { action: "withdraw" as const, expectedRevision: 3, reason: "Correct notes" },
};
beforeEach(() => {
  state.rows = [];
  state.queries = [];
});
it("does not republish unreviewed resource metadata when withdrawing another pending version", async () => {
  state.rows = [
    [[...parent.slice(0, 3), "pending_review", ...parent.slice(4), true]],
    [["usr_a", "developer"]],
    [build()],
    [build("draft", 4)],
    [["0.9.0"]],
    [],
    [],
    [],
  ];
  expect(await repo.command(input)).toMatchObject({ status: "draft" });
  const product = state.queries.find((q) => q.sql.startsWith('update "products"'));
  expect(product?.params).toContain("draft");
  expect(product?.params).not.toContain("published");
});
it("withdraws atomically and keeps another pending build in review", async () => {
  state.rows = [
    [parent],
    [["usr_a", "developer"]],
    [build()],
    [build("draft", 4)],
    [],
    [["2.0.0"]],
    [],
    [],
  ];
  expect(await repo.command(input)).toMatchObject({ status: "draft", revision: 4 });
  expect(state.queries[0].sql).toContain("for no key update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain("for update");
  expect(state.queries[3].sql).toContain('"builds"."revision" =');
  expect(state.queries[3].params).toEqual(["draft", "bld_a", "prd_a", 3, "pending_review"]);
  const product = state.queries.find((q) => q.sql.startsWith('update "products"'));
  expect(product?.params).toContain("pending_review");
  expect(product?.params).toContain("2.0.0");
  expect(product?.sql).toContain("interval '1 millisecond'");
  expect(state.queries.at(-1)?.sql).toContain('insert into "audit_events"');
});
it("rejects stale revisions before any write or artifact read", async () => {
  state.rows = [[parent], [["usr_a", "developer"]], [build("pending_review", 5)]];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "BUILD_REVISION_CONFLICT" });
  expect(state.queries).toHaveLength(3);
});
it("rechecks current organization grants instead of the original author", async () => {
  state.rows = [
    [parent.slice(0, 5).concat("org_a")],
    [["usr_other"]],
    [["usr_a", "developer"]],
    [],
  ];
  await expect(repo.command(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries[1].sql).toContain('from "organizations"');
  expect(state.queries[3].sql).toContain('from "organization_members"');
  expect(state.queries.every((q) => !q.sql.startsWith("update"))).toBe(true);
});
it("edits rejected metadata into a draft without touching uploaded identity", async () => {
  state.rows = [
    [parent],
    [["usr_a", "developer"]],
    [build("rejected")],
    [build("draft", 4, "Fixed notes")],
    [["1.1.0"]],
    [],
    [],
    [],
  ];
  await repo.command({
    ...input,
    command: {
      action: "save",
      expectedRevision: 3,
      releaseNotes: "Fixed notes",
      mtaVersionTarget: "",
    },
  });
  const update = state.queries.find((q) => q.sql.startsWith('update "builds"'));
  expect(update?.sql.split(" where ")[0]).toContain('"release_notes"');
  for (const field of [
    "storage_key",
    "sha256_hash",
    "version",
    "scan_status",
    "scanner",
    "scanned_at",
  ])
    expect(update?.sql.split(" where ")[0]).not.toContain(`"${field}"`);
  expect(state.queries.at(-1)?.params).not.toContain("Fixed notes");
});
it("does not write or audit an identical draft save", async () => {
  state.rows = [[parent], [["usr_a", "developer"]], [build("draft")]];
  expect(
    await repo.command({
      ...input,
      command: { action: "save", expectedRevision: 3, releaseNotes: "", mtaVersionTarget: "" },
    }),
  ).toMatchObject({ revision: 3 });
  expect(state.queries).toHaveLength(3);
});
it("requires clean scanner provenance in the resubmission SQL", async () => {
  state.rows = [[parent], [["usr_a", "developer"]], [build("rejected")], []];
  await expect(
    repo.command({ ...input, command: { ...input.command, action: "submit" } }),
  ).rejects.toMatchObject({ code: "BUILD_SCAN_NOT_CLEAN" });
  expect(state.queries[3].sql).toContain('"builds"."scan_status" =');
  expect(state.queries[3].sql).toContain('"builds"."scanned_at" is not null');
  expect(state.queries).toHaveLength(4);
});
it.each(["retired", "quarantined", "published"])("cannot resubmit %s", async (status) => {
  state.rows = [[parent], [["usr_a", "developer"]], [build(status)]];
  await expect(
    repo.command({ ...input, command: { ...input.command, action: "submit" } }),
  ).rejects.toMatchObject({ code: "BUILD_TRANSITION_INVALID" });
});
it.each(["archived", "suspended"])("does not submit a %s resource", async (status) => {
  const product = [...parent];
  product[3] = status;
  state.rows = [[product], [["usr_a", "developer"]], [build("draft")]];
  await expect(
    repo.command({ ...input, command: { ...input.command, action: "submit" } }),
  ).rejects.toMatchObject({ code: "PRODUCT_STATE_CHANGED" });
});
it("allows withdrawal during suspension without reviving the resource", async () => {
  const product = [...parent];
  product[3] = "suspended";
  state.rows = [[product], [["usr_a", "developer"]], [build()], [build("draft", 4)], []];
  await repo.command(input);
  expect(state.queries.some((q) => q.sql.startsWith('update "products"'))).toBe(false);
});
it("returns only private presentation fields and bounded event history", async () => {
  state.rows = [[parent], [["usr_a", "developer"]], [build()], []];
  const result = await repo.detail("prd_a", "bld_a", "usr_a");
  expect(result.build).not.toHaveProperty("storageKey");
  expect(result.product).not.toHaveProperty("authorId");
  expect(state.queries[3].params.at(-1)).toBe(20);
  expect(state.queries[3].sql).not.toContain('"actor_id"');
  expect(state.queries[3].sql).toContain("->>'reason'");
  expect(state.queries[2].sql).not.toContain("storage_key");
});
it("staff history rechecks the live role", async () => {
  state.rows = [[parent], [["user"]]];
  await expect(repo.detail("prd_a", "bld_a", "usr_a", true)).rejects.toMatchObject({
    statusCode: 403,
  });
  expect(state.queries).toHaveLength(2);
});

it("moderation also compares the reviewer-observed build revision under the product lock", async () => {
  const { buildRepository } = await import("../packages/db/src/repositories/builds");
  state.rows = [[["prd_a"]], [["prd_a", "published", "usr_a", null]], [["moderator"]], [["ses_staff", "2099-01-01T00:00:00.000Z"]], []];
  const audit = {
    id: "aud_review",
    actorId: "usr_staff",
    actorType: "user" as const,
    action: "build.approved",
    targetId: "bld_a",
    targetType: "build",
  };
  expect(await buildRepository.moderatePending("bld_a", "approve", audit, 3, "staff-session")).toBeNull();
  expect(state.queries[1].sql).toContain("for no key update");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain('"sessions"');
  expect(state.queries[3].sql).toContain("for update");
  expect(state.queries[4].sql).toContain('"builds"."revision" =');
  expect(state.queries[4].params).toContain(3);
  expect(state.queries).toHaveLength(5);
});
