import { getTableColumns } from "drizzle-orm";
import type { Build } from "@nexus/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { builds } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: 0,
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
        // SQL/branch checks only; real rollback and concurrency use PostgreSQL fixtures.
        if (key === "transaction")
          return (run: (tx: typeof database) => unknown) => {
            state.transactions += 1;
            return run(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { BuildRepository } from "../packages/db/src/repositories/builds";

const repository = new BuildRepository();
const pending: Omit<Build, "createdAt"> = {
  id: "pending",
  productId: "product",
  version: "2.0.0",
  status: "pending_review",
  storageKey: "private/pending.zip",
  fileName: "pending.zip",
  mimeType: "application/zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 4,
  scanStatus: "clean",
  scanner: "fixture",
  scannedAt: new Date("2026-10-14T00:00:00Z"),
  isSigned: false,
};
const audit = {
  id: "audit",
  actorId: "author",
  actorType: "user" as const,
  action: "build.submitted_for_review",
  targetId: pending.id,
  targetType: "build",
};
function rows(hasPublished: boolean, metadataReviewRequired = false) {
  const values: Record<string, unknown> = { ...pending, createdAt: new Date() };
  const buildRow = Object.keys(getTableColumns(builds)).map((key) => {
    const value = values[key];
    return value instanceof Date ? value.toISOString() : (value ?? null);
  });
  state.rows = [
    [["product", "published", "author", null, metadataReviewRequired]],
    [["author", "developer"]],
    [buildRow],
    hasPublished ? [["approved"]] : [],
    [],
    [],
  ];
}
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.transactions = 0;
});

describe("build review continuity", () => {
  it.each([
    { hasPublished: true, metadataReviewRequired: false, movesToReview: false },
    { hasPublished: false, metadataReviewRequired: false, movesToReview: true },
    { hasPublished: true, metadataReviewRequired: true, movesToReview: true },
    { hasPublished: false, metadataReviewRequired: true, movesToReview: true },
  ])(
    "preserves safe publication unless review is required: %j",
    async ({ hasPublished, metadataReviewRequired, movesToReview }) => {
      rows(hasPublished, metadataReviewRequired);
      const created = await repository.submitForReview(pending, audit);
      expect(created).toMatchObject({ id: pending.id, status: "pending_review", version: "2.0.0" });
      expect(state.transactions).toBe(1);
      expect(state.queries[0].sql).toContain("for no key update");
      expect(state.queries[1].sql).toContain("for share");
      expect(state.queries[2].sql).toMatch(/^insert into "builds" /u);
      const publication = state.queries[3];
      expect(publication.params).toEqual(["product", "published", "clean", 1]);
      expect(publication.sql).toContain('"builds"."scanner" is not null');
      expect(publication.sql).toContain('btrim("builds"."scanner") <> \'\'');
      expect(publication.sql).toContain('"builds"."scanned_at" is not null');
      const updates = state.queries.filter((query) => query.sql.startsWith("update"));
      expect(updates).toHaveLength(movesToReview ? 1 : 0);
      if (movesToReview) {
        expect(updates[0].sql).toMatch(/^update "products" /u);
        expect(updates[0].params).toEqual([
          "pending_review",
          "2.0.0",
          expect.any(String),
          "product",
        ]);
      }
      expect(state.queries.at(-1)?.sql).toMatch(/^insert into "audit_events" /u);
      expect(state.queries.at(-1)?.params).toEqual(
        expect.arrayContaining(["audit", "author", "build.submitted_for_review", "pending"]),
      );
    },
  );

  it.each(["archived", "suspended"])(
    "rejects a %s parent before submitting a build",
    async (status) => {
      state.rows = [[["product", status, "author", null, false]]];
      await expect(repository.submitForReview(pending, audit)).rejects.toMatchObject({
        code: "PRODUCT_STATE_CHANGED",
      });
      expect(state.queries).toHaveLength(1);
    },
  );

  it("rejects lost live authority before build, publication or audit writes", async () => {
    state.rows = [[["product", "published", "other-author", null, false]], [["author", "user"]]];
    await expect(repository.submitForReview(pending, audit)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(state.queries).toHaveLength(2);
    expect(state.queries.every((query) => query.sql.startsWith("select"))).toBe(true);
  });
});
