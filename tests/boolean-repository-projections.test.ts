import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  statements: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
}));

vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return {
    db: drizzle(async (sql, params) => {
      state.statements.push({ sql, params });
      return { rows: state.rows };
    }),
  };
});

import { SocialRepository } from "../packages/db/src/repositories/social";
import { NotificationRepository } from "../packages/db/src/repositories/notifications";

beforeEach(() => {
  state.statements = [];
  state.rows = [];
});

describe("boolean repository projections", () => {
  it.each([false, true])("checks a follow using only its ID (exists: %s)", async (exists) => {
    state.rows = exists ? [["fol_1"]] : [];
    await expect(new SocialRepository().isFollowing("usr_1", "server", "srv_1"))
      .resolves.toBe(exists);
    expect(state.statements).toHaveLength(1);
    const statement = state.statements[0];
    expect(statement?.sql.split(" from ")[0]).toBe('select "id"');
    expect(statement?.sql).toContain('"follows"."follower_id" = $1');
    expect(statement?.sql).toContain('"follows"."target_type" = $2');
    expect(statement?.sql).toContain('"follows"."target_id" = $3');
    expect(statement?.sql).toContain("limit $4");
    expect(statement?.params).toEqual(["usr_1", "server", "srv_1", 1]);
  });

  it.each([false, true])("marks an owned notification read using only its ID (matched: %s)", async (matched) => {
    state.rows = matched ? [["not_1"]] : [];
    await expect(new NotificationRepository().markAsRead("not_1", "usr_1"))
      .resolves.toBe(matched);
    expect(state.statements).toHaveLength(1);
    const statement = state.statements[0];
    expect(statement?.sql).toContain('set "is_read" = $1');
    expect(statement?.sql).toContain('"notifications"."id" = $2');
    expect(statement?.sql).toContain('"notifications"."recipient_id" = $3');
    expect(statement?.sql.split(" returning ")[1]).toBe('"id"');
    expect(statement?.params).toEqual([true, "not_1", "usr_1"]);
  });
});
