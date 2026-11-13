import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Build } from "@nexus/domain";
import { decideResourceDownloadAccess } from "../../site/src/lib/resource-download-policy";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
}));
vi.mock("../../site/packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
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

import { ResourceDownloadAuthorizationRepository } from "../../site/packages/db/src/repositories/resource-download-authorization";
import { builds } from "../../site/packages/db/src/schema";

describe("resource download authorization matrix", () => {
  const published = {
    status: "published" as const,
  };

  it("allows current resource managers and entitled users", () => {
    expect(decideResourceDownloadAccess(published, true, false)).toEqual({
      allowed: true,
      reason: "manager",
    });

    expect(decideResourceDownloadAccess(published, false, true)).toEqual({
      allowed: true,
      reason: "entitlement",
    });
  });

  it("denies a non-manager without entitlement", () => {
    expect(decideResourceDownloadAccess(published, false, false)).toEqual({
      allowed: false,
      reason: "entitlement_required",
    });
  });

  it("fails closed for unpublished resources regardless of management or entitlement", () => {
    for (const input of [
      { manager: true, entitlement: false },
      { manager: false, entitlement: true },
      { manager: true, entitlement: true },
    ]) {
      expect(
        decideResourceDownloadAccess({ status: "draft" }, input.manager, input.entitlement),
      ).toEqual({
        allowed: false,
        reason: "resource_not_published",
      });
    }
  });
});

describe("resource download final initiating-session gate", () => {
  const downloads = new ResourceDownloadAuthorizationRepository();
  const now = new Date("2026-10-10T12:00:00Z");
  const token = "download-initiating-session";
  const expected = {
    id: "bld_a",
    productId: "prd_a",
    version: "1.0.0",
    status: "published",
    scanStatus: "clean",
    scanner: "scanner",
    scannedAt: now,
    storageKey: "private.zip",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 10,
    fileName: "resource.zip",
    mimeType: "application/zip",
  } as Build;
  function buildRow(changes: Record<string, unknown> = {}) {
    const value: Record<string, unknown> = { ...expected, ...changes };
    return Object.keys(getTableColumns(builds)).map((key) => value[key] ?? null);
  }
  const writes = () => state.queries.filter((query) => query.sql.startsWith("insert"));

  beforeEach(() => {
    state.queries = [];
    state.results = [];
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it("locks access and build evidence before the initiating session, then emits receipt and start audit", async () => {
    state.results = [
      [["prd_a", "resource", "published", "usr_author", null]],
      [["usr_author", "developer"]],
      [buildRow()],
      [["ses_a", "2099-01-01T00:00:00.000Z"]],
      [],
      [],
    ];
    expect(
      await downloads.authorize({
        actorId: "usr_author",
        currentToken: token,
        auditId: "aud_a",
        receiptId: "dlv_a",
        expected,
        pinned: false,
      }),
    ).toEqual({ slug: "resource", receiptId: "dlv_a" });
    const sessionIndex = state.queries.findIndex((query) => query.sql.includes('"sessions"'));
    const receiptIndex = state.queries.findIndex((query) =>
      query.sql.startsWith('insert into "resource_delivery_receipts"'),
    );
    const auditIndex = state.queries.findIndex((query) =>
      query.sql.startsWith('insert into "audit_events"'),
    );
    expect(sessionIndex).toBeGreaterThan(2);
    expect(state.queries[sessionIndex].sql).toContain("for update");
    expect(state.queries[sessionIndex].params).toContain("usr_author");
    expect(state.queries[sessionIndex].params).toContain(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(state.queries[sessionIndex].params).not.toContain(token);
    expect(receiptIndex).toBeGreaterThan(sessionIndex);
    expect(auditIndex).toBeGreaterThan(receiptIndex);
    expect(state.queries[auditIndex].params).toContain("product.download_started");
  });

  it.each([
    { label: "missing", session: [] as unknown[] },
    { label: "expired", session: [["ses_a", "2000-01-01T00:00:00.000Z"]] },
  ])(
    "refuses a $label initiating session without receipt or download_started",
    async ({ session }) => {
      state.results = [
        [["prd_a", "resource", "published", "usr_author", null]],
        [["usr_author", "developer"]],
        [buildRow()],
        session,
      ];
      await expect(
        downloads.authorize({
          actorId: "usr_author",
          currentToken: token,
          auditId: "aud_a",
          receiptId: "dlv_a",
          expected,
          pinned: false,
        }),
      ).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
      expect(writes()).toHaveLength(0);
    },
  );

  it("does not accept another live session for the same actor", async () => {
    state.results = [
      [["prd_a", "resource", "published", "usr_author", null]],
      [["usr_author", "developer"]],
      [buildRow()],
      [],
    ];
    await expect(
      downloads.authorize({
        actorId: "usr_author",
        currentToken: "other-live-session",
        auditId: "aud_a",
        receiptId: "dlv_a",
        expected,
        pinned: false,
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
    expect(writes()).toHaveLength(0);
    const sessionQuery = state.queries.find((query) => query.sql.includes('"sessions"'));
    expect(sessionQuery?.params).toContain(
      createHash("sha256").update("other-live-session").digest("hex"),
    );
  });

  it("rechecks wall-clock expiry after the initiating session row is locked", async () => {
    state.results = [
      [["prd_a", "resource", "published", "usr_author", null]],
      [["usr_author", "developer"]],
      [buildRow()],
      // Mock returns a row that is no longer live once Date.now() is observed after FOR UPDATE.
      [["ses_a", now.toISOString()]],
    ];
    await expect(
      downloads.authorize({
        actorId: "usr_author",
        currentToken: token,
        auditId: "aud_a",
        receiptId: "dlv_a",
        expected,
        pinned: false,
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
    expect(writes()).toHaveLength(0);
    expect(state.queries.some((query) => query.sql.includes('"sessions"'))).toBe(true);
  });

  it("refuses an empty initiating token before any write", async () => {
    state.results = [
      [["prd_a", "resource", "published", "usr_author", null]],
      [["usr_author", "developer"]],
      [buildRow()],
    ];
    await expect(
      downloads.authorize({
        actorId: "usr_author",
        currentToken: "",
        auditId: "aud_a",
        receiptId: "dlv_a",
        expected,
        pinned: false,
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
    expect(writes()).toHaveLength(0);
    expect(state.queries.some((query) => query.sql.includes('"sessions"'))).toBe(false);
  });
});
