import { getTableColumns } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return {
    db: drizzle(async (sql, params) => {
      state.queries.push({ sql, params });
      return { rows: state.rows };
    }),
  };
});

import { VerificationRepository } from "../packages/db/src/repositories/verification";
import { verificationApplicationRevision } from "../packages/db/src/repositories/verification-application-version";
import { verificationRequests } from "../packages/db/src/schema";

beforeEach(() => {
  state.queries = [];
  state.rows = [];
});
describe("verification queue query", () => {
  it("keeps oldest pending applications first and reads each current evidence stamp in one bounded lateral query", async () => {
    const fields: Record<string, unknown> = {
      status: "pending",
      createdAt: "2026-10-11T00:00:00Z",
    };
    state.rows = Array.from({ length: 31 }, (_, index) => [
      ...Object.keys(getTableColumns(verificationRequests)).map((key) =>
        key === "id" ? `ver-${index}` : (fields[key] ?? null),
      ),
      null,
      null,
      null,
      null,
      `audit-${index}`,
      "verification.application_updated",
    ]);
    const result = await new VerificationRepository().listPage("pending", 4);
    expect(result.requests).toHaveLength(30);
    expect(result.hasMore).toBe(true);
    expect(result.requests[0]).toMatchObject({
      applicationRevision: verificationApplicationRevision("ver-0", "pending", "audit-0"),
      evidenceUpdated: true,
    });
    expect(JSON.stringify(result)).not.toContain("evidenceEventId");
    expect(state.queries).toHaveLength(1);
    const query = state.queries[0];
    expect(query.sql).toContain("left join lateral");
    expect(query.sql).toContain(
      '"audit_events"."actor_id" = "verification_requests"."requester_id"',
    );
    expect(query.sql).toContain('where "verification_requests"."status" =');
    expect(query.sql).toContain(
      'order by "verification_requests"."created_at" asc, "verification_requests"."id" asc',
    );
    expect(query.params.slice(-3)).toEqual(["pending", 31, 90]);
  });
  it("separates final decisions and rejects excessive scan ranges before querying", async () => {
    expect((await new VerificationRepository().listPage("history", 1)).hasMore).toBe(false);
    expect(state.queries[0].params.slice(-3)).toEqual(["approved", "rejected", 31]);
    expect(state.queries[0].sql).not.toContain("offset");
    expect(state.queries[0].sql).toContain(
      'order by "verification_requests"."resolved_at" desc, "verification_requests"."id" desc',
    );
    state.queries = [];
    await expect(new VerificationRepository().listPage("pending", 0)).rejects.toThrow(RangeError);
    await expect(new VerificationRepository().listPage("pending", 1, 101)).rejects.toThrow(
      RangeError,
    );
    expect(state.queries).toHaveLength(0);
  });
});
