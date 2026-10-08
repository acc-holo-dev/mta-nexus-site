import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditEvents, comments, content } from "../packages/db/src/schema";

const captured = vi.hoisted(() => ({
  transactionCalls: 0,
  inserts: [] as unknown[],
  updateTable: null as unknown,
  updateValues: null as Record<string, unknown> | null,
  updateWhere: null as SQL | null,
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      captured.transactionCalls += 1;
      const tx = {
        insert(table: unknown) {
          captured.inserts.push(table);
          return {
            values(value: unknown) {
              if (table === comments) {
                return {
                  returning: async () => [
                    { ...(value as Record<string, unknown>) },
                  ],
                };
              }
              return Promise.resolve();
            },
          };
        },
        update(table: unknown) {
          captured.updateTable = table;
          return {
            set(values: Record<string, unknown>) {
              captured.updateValues = values;
              return {
                where: async (where: SQL) => {
                  captured.updateWhere = where;
                },
              };
            },
          };
        },
      };
      return run(tx);
    },
  },
}));

import { ContentRepository } from "../packages/db/src/repositories/content";

describe("article comment persistence", () => {
  beforeEach(() => {
    captured.transactionCalls = 0;
    captured.inserts = [];
    captured.updateTable = null;
    captured.updateValues = null;
    captured.updateWhere = null;
  });

  it("stores comment, increments article count and writes audit in one transaction", async () => {
    const repository = new ContentRepository();
    const created = await repository.addComment(
      {
        id: "cmt_1",
        contentId: "cnt_1",
        authorId: "usr_1",
        text: "Useful comment",
        isVerifiedPurchase: false,
      },
      {
        id: "aud_1",
        actorId: "usr_1",
        actorType: "user",
        action: "content.comment_added",
        targetId: "cnt_1",
        targetType: "content",
      },
    );

    expect(created).toMatchObject({
      id: "cmt_1",
      contentId: "cnt_1",
      isVerifiedPurchase: false,
    });
    expect(captured.transactionCalls).toBe(1);
    expect(captured.inserts).toEqual([comments, auditEvents]);
    expect(captured.updateTable).toBe(content);
    expect(captured.updateValues).toMatchObject({
      updatedAt: expect.any(Date),
    });
    const increment = captured.updateValues?.commentCount;
    expect(increment).toBeTruthy();
    expect(new PgDialect().sqlToQuery(increment as SQL).sql).toContain("+ 1");
    expect(captured.updateWhere).toBeTruthy();
  });

  it("does not touch article counters for non-article comments", async () => {
    const repository = new ContentRepository();
    await repository.addComment({
      id: "cmt_product",
      productId: "prd_1",
      authorId: "usr_1",
      text: "Product discussion",
      isVerifiedPurchase: false,
    });
    expect(captured.transactionCalls).toBe(1);
    expect(captured.inserts).toEqual([comments]);
    expect(captured.updateTable).toBeNull();
  });
});
