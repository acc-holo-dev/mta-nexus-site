import { beforeEach, describe, expect, it, vi } from "vitest";

type Placement = {
  id: string;
  slotId: string;
  advertiserUserId: string;
  targetType: string;
  targetId: string;
  startsAt: Date;
  endsAt: Date;
  maxImpressions: number | null;
  audience: string[] | null;
  moderationBasis: string | null;
  status: string;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Audit = {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  details: unknown;
};

type Tx = {
  id: string;
  placements: Map<string, Placement>;
  audits: Audit[];
  releases: Array<() => void>;
};

const state = vi.hoisted(() => ({
  placements: new Map<string, Placement>(),
  slots: new Map<string, { id: string; capacity: number }>(),
  audits: [] as Audit[],
  queries: [] as { sql: string; txId: string | null }[],
  failAudit: false,
  lockTails: new Map<string, Promise<void>>(),
  nextTx: 0,
}));

const placementColumns: Record<string, keyof Placement> = {
  id: "id",
  slot_id: "slotId",
  advertiser_user_id: "advertiserUserId",
  target_type: "targetType",
  target_id: "targetId",
  starts_at: "startsAt",
  ends_at: "endsAt",
  max_impressions: "maxImpressions",
  audience: "audience",
  moderation_basis: "moderationBasis",
  status: "status",
  reason: "reason",
  created_at: "createdAt",
  updated_at: "updatedAt",
};

vi.mock("../../packages/db/src/client", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const als = new AsyncLocalStorage<Tx>();

  function normalize(sql: string): string {
    return sql.replace(/\s+/g, " ").trim();
  }

  function paramIndex(token: string): number {
    return Number(token.replace("$", "")) - 1;
  }

  function visiblePlacements(tx: Tx | undefined): Map<string, Placement> {
    const rows = new Map(state.placements);
    if (tx) {
      for (const [id, row] of tx.placements) rows.set(id, row);
    }
    return rows;
  }

  function acquire(key: string): Promise<() => void> {
    const prev = state.lockTails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.lockTails.set(
      key,
      prev.then(() => gate),
    );
    return prev.then(() => () => release());
  }

  function placementValues(row: Placement, columns: string[]): unknown[] {
    return columns.map((column) => {
      const field = placementColumns[column];
      if (!field) throw new Error(`unknown placement column ${column}`);
      return row[field];
    });
  }

  async function query(sql: string, params: unknown[]): Promise<{ rows: unknown[][] }> {
    const tx = als.getStore();
    const text = normalize(sql);
    state.queries.push({ sql: text, txId: tx?.id ?? null });
    const where = text.split(/ where /i)[1] ?? "";

    if (/from "ad_slots"/i.test(text) && /for update/i.test(text)) {
      const idToken = where.match(/"id" = \$(\d+)/i);
      if (!idToken) throw new Error(`slot lock without id: ${text}`);
      const slotId = String(params[paramIndex(idToken[1] ?? "")]);
      if (tx) tx.releases.push(await acquire(`slot:${slotId}`));
      const slot = state.slots.get(slotId);
      if (!slot) return { rows: [] };
      return { rows: [[slot.capacity]] };
    }

    if (/count\(/i.test(text) && /from "ad_placements"/i.test(text)) {
      const slotToken = where.match(/"slot_id" = \$(\d+)/i);
      const statusList = where.match(/"status" in \(([^)]+)\)/i);
      if (!slotToken || !statusList) throw new Error(`unparsed count: ${text}`);
      const slotId = String(params[paramIndex(slotToken[1] ?? "")]);
      const statuses = new Set(
        statusList[1]
          ?.split(",")
          .map((token) => params[paramIndex(token.trim())])
          .map(String),
      );
      const active = [...visiblePlacements(tx).values()].filter(
        (row) => row.slotId === slotId && statuses.has(row.status),
      ).length;
      return { rows: [[active]] };
    }

    if (/^select /i.test(text) && /from "ad_placements"/i.test(text)) {
      const listed = text.match(/^select (.+) from /i)?.[1] ?? "";
      const columns = listed.split(",").map((part) => part.trim().match(/([a-z0-9_]+)"?$/i)?.[1]);
      const idToken = where.match(/"id" = \$(\d+)/i);
      if (!idToken || columns.some((column) => !column)) {
        throw new Error(`unparsed placement read: ${text}`);
      }
      const row = visiblePlacements(tx).get(String(params[paramIndex(idToken[1] ?? "")]));
      if (!row) return { rows: [] };
      return { rows: [placementValues(row, columns as string[])] };
    }

    if (/^update "ad_placements"/i.test(text)) {
      const assignments = [...text.matchAll(/"([a-z0-9_]+)" = \$(\d+)/gi)];
      const idToken = where.match(/"id" = \$(\d+)/i);
      if (!idToken) throw new Error(`unparsed placement update: ${text}`);
      const id = String(params[paramIndex(idToken[1] ?? "")]);
      const current = visiblePlacements(tx).get(id);
      if (!current) return { rows: [] };
      const next = { ...current };
      for (const match of assignments) {
        const field = placementColumns[match[1] ?? ""];
        if (!field || match[1] === "id") continue;
        (next as Record<string, unknown>)[field] = params[paramIndex(match[2] ?? "")];
      }
      if (tx) tx.placements.set(id, next);
      else state.placements.set(id, next);
      return { rows: [] };
    }

    if (/^insert into "audit_events"/i.test(text)) {
      if (state.failAudit) throw new Error("audit insert failed");
      const inserted = text.match(/insert into "audit_events" \((.+)\) values \((.+)\)/i);
      if (!inserted) throw new Error(`unparsed audit insert: ${text}`);
      const columns = (inserted[1] ?? "")
        .split(",")
        .map((column) => column.trim().replaceAll('"', ""));
      const tokens = (inserted[2] ?? "").split(",").map((token) => token.trim());
      const record: Record<string, unknown> = {};
      for (const [index, column] of columns.entries()) {
        const token = tokens[index] ?? "";
        if (/^default$/i.test(token)) continue;
        const param = token.match(/^\$(\d+)$/);
        if (!param) throw new Error(`unparsed audit value ${token} in ${text}`);
        record[column] = params[Number(param[1]) - 1];
      }
      const details = record.details;
      const audit: Audit = {
        id: String(record.id),
        actorId: String(record.actor_id),
        action: String(record.action),
        targetId: String(record.target_id),
        details: typeof details === "string" ? JSON.parse(details) : details,
      };
      if (tx) tx.audits.push(audit);
      else state.audits.push(audit);
      return { rows: [] };
    }

    throw new Error(`unrecognized sql: ${text}`);
  }

  const database = drizzle(async (sql, params) => query(sql, params));
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction") {
          return async (callback: (tx: typeof database) => unknown) => {
            state.nextTx += 1;
            const tx: Tx = {
              id: `tx_${state.nextTx}`,
              placements: new Map(),
              audits: [],
              releases: [],
            };
            try {
              const result = await als.run(tx, () => callback(database));
              for (const [id, row] of tx.placements) state.placements.set(id, row);
              state.audits.push(...tx.audits);
              return result;
            } finally {
              for (const release of tx.releases) release();
              tx.releases.length = 0;
            }
          };
        }
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { AdPlacementRepository } from "../../packages/db/src/repositories/sponsored-placement";

const repo = new AdPlacementRepository();
const admin = { id: "admin_1", isAdmin: true };

function seed(id: string, slotId = "slot_home"): void {
  const now = new Date("2026-11-01T00:00:00.000Z");
  state.placements.set(id, {
    id,
    slotId,
    advertiserUserId: "user_advertiser",
    targetType: "product",
    targetId: "prod_1",
    startsAt: now,
    endsAt: new Date("2026-12-01T00:00:00.000Z"),
    maxImpressions: null,
    audience: null,
    moderationBasis: null,
    status: "pending_approval",
    reason: null,
    createdAt: now,
    updatedAt: now,
  });
}

beforeEach(() => {
  state.placements.clear();
  state.slots.clear();
  state.audits.length = 0;
  state.queries.length = 0;
  state.failAudit = false;
  state.lockTails.clear();
  state.nextTx = 0;
  state.slots.set("slot_home", { id: "slot_home", capacity: 1 });
  seed("ad_a");
  seed("ad_b");
});

describe("AUD-07 ad slot capacity and audit", () => {
  it("lets one of two parallel approves reserve a capacity-1 slot", async () => {
    const results = await Promise.allSettled([
      repo.approve(admin, "ad_a"),
      repo.approve(admin, "ad_b"),
    ]);
    const scheduled = ["ad_a", "ad_b"].filter(
      (id) => state.placements.get(id)?.status === "scheduled",
    );
    const pending = ["ad_a", "ad_b"].filter(
      (id) => state.placements.get(id)?.status === "pending_approval",
    );
    expect(scheduled, state.queries.map((query) => query.sql).join("\n")).toHaveLength(1);
    expect(pending).toHaveLength(1);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({
      code: "CONFLICT",
    });
    expect(state.audits.map((audit) => audit.targetId)).toEqual(scheduled);
    expect(state.audits.map((audit) => audit.action)).toEqual(["ad_placement.scheduled"]);
    const winner = state.queries.find((query) => query.sql.startsWith("update"))?.txId;
    expect(winner).toEqual(expect.any(String));
    const winnerSql = state.queries
      .filter((query) => query.txId === winner)
      .map((query) => query.sql);
    expect(winnerSql.some((sql) => sql.includes("for update") && sql.includes('"ad_slots"'))).toBe(
      true,
    );
    expect(winnerSql.some((sql) => sql.startsWith("update"))).toBe(true);
    expect(winnerSql.some((sql) => sql.startsWith('insert into "audit_events"'))).toBe(true);
  });

  it("reserves both placements when the slot capacity is 2", async () => {
    state.slots.set("slot_home", { id: "slot_home", capacity: 2 });
    const results = await Promise.allSettled([
      repo.approve(admin, "ad_a"),
      repo.approve(admin, "ad_b"),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(state.placements.get("ad_a")?.status).toBe("scheduled");
    expect(state.placements.get("ad_b")?.status).toBe("scheduled");
    expect(state.audits.map((audit) => audit.targetId).sort()).toEqual(["ad_a", "ad_b"]);
  });

  it("rolls the scheduled status back when the audit insert fails", async () => {
    state.failAudit = true;
    await expect(repo.approve(admin, "ad_a")).rejects.toSatisfy((error: unknown) => {
      const messages: string[] = [];
      let current = error;
      while (current instanceof Error) {
        messages.push(current.message);
        current = current.cause;
      }
      return messages.some((message) => message.includes("audit insert failed"));
    });
    expect(state.placements.get("ad_a")?.status).toBe("pending_approval");
    expect(state.audits).toEqual([]);

    state.failAudit = false;
    const approved = await repo.approve(admin, "ad_a");
    expect(approved.status).toBe("scheduled");
    expect(state.placements.get("ad_a")?.status).toBe("scheduled");
    expect(state.placements.get("ad_b")?.status).toBe("pending_approval");
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: "ad_placement.scheduled",
        targetId: "ad_a",
        actorId: "admin_1",
        details: { from: "pending_approval" },
      }),
    ]);
  });
});
