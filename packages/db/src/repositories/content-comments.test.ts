import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditEvents, comments, content, discussionNotificationDeliveries } from "../schema";
import {
  commentIdFromIntentKey,
  ContentCommentsRepository,
  parseCommentIntentKey,
} from "./content-comments";

const INTENT = "12345678-1234-4234-8234-123456789abc";
const COMMENT_ID = commentIdFromIntentKey(INTENT);

const captured = vi.hoisted(() => ({
  transactionCalls: 0,
  inserts: [] as unknown[],
  updateTable: null as unknown,
  updateValues: null as Record<string, unknown> | null,
  updateWhere: null as SQL | null,
  insertConflict: false,
  existing: null as Record<string, unknown> | null,
  selectCalls: 0,
  review: vi.fn(),
  parentLock: true,
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
            from(table: unknown) {
              return {
                where() {
                  return {
                    limit() {
                      return {
                        for: async () => {
                          if (table === comments) {
                            return captured.parentLock ? [{ id: "parent" }] : [];
                          }
                          return [{ status: "published" }];
                        },
                      };
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
                const returning = async () =>
                  captured.insertConflict ? [] : [{ ...(value as Record<string, unknown>) }];
                return {
                  returning,
                  onConflictDoNothing() {
                    return { returning };
                  },
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
    select() {
      captured.selectCalls += 1;
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => (captured.existing ? [captured.existing] : []),
              };
            },
          };
        },
      };
    },
  },
}));

import { ContentRepository } from "./content";

describe("article comment intent protocol", () => {
  beforeEach(() => {
    captured.transactionCalls = 0;
    captured.inserts = [];
    captured.updateTable = null;
    captured.updateValues = null;
    captured.updateWhere = null;
    captured.insertConflict = false;
    captured.existing = null;
    captured.selectCalls = 0;
    captured.parentLock = true;
    captured.review.mockReset();
  });

  it("accepts only canonical UUIDv4 intent keys", () => {
    expect(parseCommentIntentKey(INTENT)).toBe(INTENT);
    expect(parseCommentIntentKey("not-a-uuid")).toBeNull();
    expect(commentIdFromIntentKey(INTENT)).toBe(`cmt_${INTENT.replaceAll("-", "")}`);
  });

  it("stores comment, increments article count, fanout and audit once for a new intent", async () => {
    const result = await new ContentCommentsRepository().addArticleComment({
      intentKey: INTENT,
      contentId: "cnt_1",
      authorId: "usr_1",
      text: "Useful comment",
      audit: {
        id: "aud_1",
        actorId: "usr_1",
        actorType: "user",
        action: "content.comment_added",
        targetId: "cnt_1",
        targetType: "content",
      },
    });

    expect(result).toMatchObject({
      kind: "created",
      comment: { id: COMMENT_ID, contentId: "cnt_1", text: "Useful comment" },
    });
    expect(captured.transactionCalls).toBe(1);
    expect(captured.inserts).toEqual([comments, discussionNotificationDeliveries, auditEvents]);
    expect(captured.updateTable).toBe(content);
    expect(captured.selectCalls).toBe(0);
    const increment = captured.updateValues?.commentCount;
    expect(increment).toBeTruthy();
    expect(new PgDialect().sqlToQuery(increment as SQL).sql).toContain("+ 1");
    expect(captured.updateWhere).toBeTruthy();
  });

  it("replays the same intent after commit without a second fanout write", async () => {
    captured.insertConflict = true;
    captured.existing = {
      id: COMMENT_ID,
      contentId: "cnt_1",
      authorId: "usr_1",
      parentId: null,
      productId: null,
      text: "Useful comment",
    };
    const result = await new ContentCommentsRepository().addArticleComment({
      intentKey: INTENT,
      contentId: "cnt_1",
      authorId: "usr_1",
      text: "Useful comment",
      audit: {
        id: "aud_1",
        actorId: "usr_1",
        actorType: "user",
        action: "content.comment_added",
        targetId: "cnt_1",
        targetType: "content",
      },
    });

    expect(result).toMatchObject({ kind: "replayed", comment: { id: COMMENT_ID } });
    expect(captured.inserts).toEqual([comments]);
    expect(captured.updateTable).toBeNull();
    expect(captured.selectCalls).toBe(1);
  });

  it("rejects payload mismatch on a reused intent key without creating another comment", async () => {
    captured.insertConflict = true;
    captured.existing = {
      id: COMMENT_ID,
      contentId: "cnt_1",
      authorId: "usr_1",
      parentId: null,
      productId: null,
      text: "Original text",
    };
    await expect(
      new ContentCommentsRepository().addArticleComment({
        intentKey: INTENT,
        contentId: "cnt_1",
        authorId: "usr_1",
        text: "Different text",
        audit: {
          id: "aud_1",
          actorId: "usr_1",
          actorType: "user",
          action: "content.comment_added",
          targetId: "cnt_1",
          targetType: "content",
        },
      }),
    ).resolves.toEqual({ kind: "key_conflict" });
    expect(captured.updateTable).toBeNull();
  });

  it("allows a new intent with the same text as a distinct comment id", () => {
    const other = "aaaaaaaa-1234-4234-8234-123456789abc";
    expect(commentIdFromIntentKey(other)).not.toBe(COMMENT_ID);
  });
});

describe("legacy content repository article and review writes", () => {
  beforeEach(() => {
    captured.transactionCalls = 0;
    captured.inserts = [];
    captured.updateTable = null;
    captured.updateValues = null;
    captured.updateWhere = null;
    captured.insertConflict = false;
    captured.existing = null;
    captured.selectCalls = 0;
    captured.parentLock = true;
    captured.review.mockReset();
  });

  it("stores comment, increments article count and writes audit in one transaction", async () => {
    const created = await new ContentRepository().addComment(
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
    expect(captured.inserts).toEqual([comments, discussionNotificationDeliveries, auditEvents]);
    expect(captured.updateTable).toBe(content);
    expect(captured.updateValues).not.toHaveProperty("updatedAt");
    const increment = captured.updateValues?.commentCount;
    expect(increment).toBeTruthy();
    expect(new PgDialect().sqlToQuery(increment as SQL).sql).toContain("+ 1");
    expect(captured.updateWhere).toBeTruthy();
  });

  it("routes rated product feedback through the review command without article writes", async () => {
    captured.review.mockResolvedValue({ id: "cmt_product", ratingCount: 1, ratingAverage: 5 });
    const created = await new ContentRepository().addComment({
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
