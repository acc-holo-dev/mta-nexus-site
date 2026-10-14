import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditEvents, comments, content } from "../schema";

const captured = vi.hoisted(() => ({
  transactionCalls: 0,
  inserts: [] as unknown[],
  updateTable: null as unknown,
  updateValues: null as Record<string, unknown> | null,
  updateWhere: null as SQL | null,
  review: vi.fn(),
}));

vi.mock("./resource-reviews", () => ({
  resourceReviewsRepository: { command: captured.review },
}));

vi.mock("../client", () => ({
  db: {
    transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      captured.transactionCalls += 1;
      const tx = {
        select() {
          return {
            from() {
              return {
                where() {
                  return {
                    limit() {
                      return { for: async () => [{ status: "published" }] };
                    },
                  };
                },
              };
            },
          };
        },
        insert(table: unknown) {
          captured.inserts.push(table);
          return {
            values(value: unknown) {
              if (table === comments) {
                return {
                  returning: async () => [{ ...(value as Record<string, unknown>) }],
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

import { ContentRepository } from "./content";

describe("article comment persistence", () => {
  beforeEach(() => {
    captured.transactionCalls = 0;
    captured.inserts = [];
    captured.updateTable = null;
    captured.updateValues = null;
    captured.updateWhere = null;
    captured.review.mockReset();
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
    expect(captured.updateValues).not.toHaveProperty("updatedAt");
    const increment = captured.updateValues?.commentCount;
    expect(increment).toBeTruthy();
    expect(new PgDialect().sqlToQuery(increment as SQL).sql).toContain("+ 1");
    expect(captured.updateWhere).toBeTruthy();
  });

  it("routes rated product feedback through the review command without article writes", async () => {
    const repository = new ContentRepository();
    captured.review.mockResolvedValue({ id: "cmt_product", ratingCount: 1, ratingAverage: 5 });
    const created = await repository.addComment({
      id: "cmt_product",
      productId: "prd_1",
      authorId: "usr_1",
      text: " Product review ",
      rating: 5,
      isVerifiedPurchase: false,
    });
    expect(captured.review).toHaveBeenCalledExactlyOnceWith({
      actorId: "usr_1",
      productId: "prd_1",
      reviewId: "cmt_product",
      auditId: "aud_cmt_product",
      command: { action: "save", expectedRevision: 0, text: " Product review ", rating: 5 },
    });
    expect(created).toMatchObject({
      id: "cmt_product",
      productId: "prd_1",
      text: "Product review",
      rating: 5,
      isVerifiedPurchase: true,
    });
    expect(captured.transactionCalls).toBe(0);
    expect(captured.inserts).toEqual([]);
    expect(captured.updateTable).toBeNull();
  });

  it.each([
    { rating: undefined },
    { rating: 5, contentId: "cnt_1" },
    { rating: 5, parentId: "cmt_parent" },
  ])("rejects invalid product review targets before any write: %j", async (target) => {
    await expect(
      new ContentRepository().addComment({
        id: "cmt_product",
        productId: "prd_1",
        authorId: "usr_1",
        text: "Review",
        isVerifiedPurchase: false,
        ...target,
      }),
    ).rejects.toMatchObject({ code: "REVIEW_INVALID" });
    expect(captured.review).not.toHaveBeenCalled();
    expect(captured.transactionCalls).toBe(0);
    expect(captured.inserts).toEqual([]);
    expect(captured.updateTable).toBeNull();
  });
});
