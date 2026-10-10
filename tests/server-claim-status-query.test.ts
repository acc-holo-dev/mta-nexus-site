import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
  failure: null as Error | null,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failure) throw state.failure;
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { readManagedServerClaimStatus } from "../packages/db/src/repositories/server-claim-status";
const actor = { id: "manager", role: "user" as const };
beforeEach(() => {
  state.queries = [];
  state.config = null;
  state.failure = null;
  state.rows = [
    [[false, 2, "org_a"]],
    [["pending", "2026-10-10T12:00:00Z", null, false, 2, true, "org_a"]],
  ];
});
it("checks current ownership grants before reading private status in one snapshot", async () => {
  expect(await readManagedServerClaimStatus("srv_a", actor)).toEqual({
    isVerified: false,
    request: {
      status: "pending",
      createdAt: new Date("2026-10-10T12:00:00Z"),
      resolvedAt: null,
      isRequester: false,
      proofMatchesServer: true,
    },
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries[0].sql).toContain('"organizations"."id" = "servers"."organization_id"');
  expect(state.queries[0].params).toContain('["manage_servers"]');
});
it("does not read another server's pending request without permission", async () => {
  state.rows = [[]];
  expect(await readManagedServerClaimStatus("srv_a", actor)).toBeNull();
  expect(state.queries).toHaveLength(1);
});
it("preserves only the administrator override", async () => {
  await readManagedServerClaimStatus("srv_a", { id: "admin", role: "admin" });
  expect(state.queries[0].sql).not.toContain("exists");
});
it("bounds status to one target with deterministic order and no internal evidence", async () => {
  await readManagedServerClaimStatus("srv_a", actor);
  const read = state.queries[1];
  expect(read.sql).toContain('"verification_requests"."target_type"');
  expect(read.sql).toContain('"verification_requests"."target_id"');
  expect(read.sql).toContain(
    'order by "verification_requests"."created_at" desc, "verification_requests"."id" desc limit',
  );
  expect(read.params.at(-1)).toBe(1);
  for (const field of ["token_digest", "proof_url", "notes", "review_notes", "email", "ip_address"])
    expect(read.sql).not.toContain(`"${field}"`);
  expect(read.sql).not.toContain("offset");
});
it.each([
  [1, true, "org_a"],
  [null, true, "org_a"],
  [2, false, "org_a"],
  [2, true, "org_b"],
  [2, true, null],
  [null, null, null],
])(
  "reports changed or missing proof without leaking its snapshot: %s %s %s",
  async (revision, recorded, organization) => {
    state.rows[1][0].splice(4, 3, revision, recorded, organization);
    const status = await readManagedServerClaimStatus("srv_a", actor);
    expect(status?.request?.proofMatchesServer).toBe(false);
    expect(status?.request).not.toHaveProperty("claimOrganizationId");
    expect(status?.request).not.toHaveProperty("endpointRevision");
  },
);
it("represents no submitted request explicitly", async () => {
  state.rows[1] = [];
  expect(await readManagedServerClaimStatus("srv_a", actor)).toEqual({
    isVerified: false,
    request: null,
  });
});
it("propagates database failures", async () => {
  state.failure = new Error("unavailable");
  await expect(readManagedServerClaimStatus("srv_a", actor)).rejects.toThrow();
});
it("rejects empty identities before querying", async () => {
  await expect(readManagedServerClaimStatus("", actor)).rejects.toThrow(RangeError);
  await expect(readManagedServerClaimStatus("srv_a", { ...actor, id: "" })).rejects.toThrow(
    RangeError,
  );
  expect(state.queries).toHaveLength(0);
});
