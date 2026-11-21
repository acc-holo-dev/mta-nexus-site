import {
  AppError,
  assertWalletAccountId,
  assertWalletAmount,
  assertWalletCurrency,
  type LedgerEntry,
  type LedgerPosting,
  type PaymentProviderId,
  type TopUpIntent,
  type TopUpIntentStatus,
  type WalletCurrency,
} from "@nexus/domain";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { walletTopupIntents } from "../schema";
import { postLedgerBatchInTransaction } from "./ledger-posting";

type WalletTopupRow = typeof walletTopupIntents.$inferSelect;

function toIntent(row: WalletTopupRow): TopUpIntent {
  return {
    id: row.id,
    accountId: row.accountId,
    amount: row.amount,
    currency: row.currency as WalletCurrency,
    providerId: row.providerId as PaymentProviderId,
    status: row.status as TopUpIntentStatus,
    idempotencyKey: row.idempotencyKey,
    providerSessionId: row.providerSessionId,
    createdAt: row.createdAt.toISOString(),
  };
}

export class WalletTopupRepository {
  async findById(id: string): Promise<TopUpIntent | null> {
    const [row] = await db
      .select()
      .from(walletTopupIntents)
      .where(eq(walletTopupIntents.id, id))
      .limit(1);
    return row ? toIntent(row) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<TopUpIntent | null> {
    const [row] = await db
      .select()
      .from(walletTopupIntents)
      .where(eq(walletTopupIntents.idempotencyKey, idempotencyKey))
      .limit(1);
    return row ? toIntent(row) : null;
  }

  async listRecentByAccount(accountId: string, limit = 20): Promise<TopUpIntent[]> {
    assertWalletAccountId(accountId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError("Top-up history limit is invalid", 400, "TOPUP_HISTORY_LIMIT_INVALID");
    }
    const rows = await db
      .select()
      .from(walletTopupIntents)
      .where(eq(walletTopupIntents.accountId, accountId))
      .orderBy(desc(walletTopupIntents.createdAt), desc(walletTopupIntents.id))
      .limit(limit);
    return rows.map(toIntent);
  }

  async insertAwaiting(input: { intent: TopUpIntent; returnPath: string }): Promise<TopUpIntent> {
    const { intent, returnPath } = input;
    assertWalletAccountId(intent.accountId);
    assertWalletAmount(intent.amount);
    assertWalletCurrency(intent.currency);
    if (intent.status !== "awaiting_provider" || !intent.providerSessionId) {
      throw new AppError("Top-up intent is not ready to persist", 400, "TOPUP_INTENT_STATE");
    }
    if (!returnPath.startsWith("/") || returnPath.length > 512 || returnPath.includes("//")) {
      throw new AppError("Top-up return path is invalid", 400, "TOPUP_RETURN_PATH_INVALID");
    }

    try {
      const [row] = await db
        .insert(walletTopupIntents)
        .values({
          id: intent.id,
          accountId: intent.accountId,
          amount: intent.amount,
          currency: intent.currency,
          providerId: intent.providerId,
          status: intent.status,
          idempotencyKey: intent.idempotencyKey,
          providerSessionId: intent.providerSessionId,
          returnPath,
          createdAt: new Date(intent.createdAt),
          updatedAt: new Date(),
        })
        .returning();
      if (!row) throw new AppError("Top-up intent insert failed", 409, "TOPUP_INSERT_FAILED");
      return toIntent(row);
    } catch (error) {
      const existing = await this.findByIdempotencyKey(intent.idempotencyKey);
      if (existing) {
        if (
          existing.accountId !== intent.accountId ||
          existing.amount !== intent.amount ||
          existing.currency !== intent.currency ||
          existing.providerId !== intent.providerId
        ) {
          throw new AppError(
            "Top-up idempotency key already used",
            409,
            "TOPUP_IDEMPOTENCY_CONFLICT",
          );
        }
        return existing;
      }
      throw error;
    }
  }

  async markSucceeded(input: {
    intentId: string;
    providerEventId: string;
    ledgerBatchId: string;
  }): Promise<TopUpIntent> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-topup:${input.intentId}`}))`,
      );
      const [current] = await tx
        .select()
        .from(walletTopupIntents)
        .where(eq(walletTopupIntents.id, input.intentId))
        .limit(1)
        .for("update");
      if (!current) throw new AppError("Top-up intent not found", 404, "TOPUP_NOT_FOUND");
      if (current.status === "succeeded") {
        if (
          current.providerEventId === input.providerEventId &&
          current.ledgerBatchId === input.ledgerBatchId
        ) {
          return toIntent(current);
        }
        throw new AppError("Top-up intent already credited", 409, "TOPUP_ALREADY_CREDITED");
      }
      if (current.status !== "awaiting_provider" && current.status !== "created") {
        throw new AppError("Top-up intent cannot be credited", 409, "TOPUP_INTENT_STATE");
      }
      const [row] = await tx
        .update(walletTopupIntents)
        .set({
          status: "succeeded",
          providerEventId: input.providerEventId,
          ledgerBatchId: input.ledgerBatchId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletTopupIntents.id, input.intentId),
            eq(walletTopupIntents.status, current.status),
          ),
        )
        .returning();
      if (!row) throw new AppError("Top-up intent credit raced", 409, "TOPUP_CREDIT_RACE");
      return toIntent(row);
    });
  }

  /**
   * Credit a verified top-up: ledger posting and intent success flip in one transaction.
   */
  async creditVerified(input: {
    intentId: string;
    providerEventId: string;
    ledgerBatchId: string;
    entries: LedgerPosting[];
  }): Promise<{ intent: TopUpIntent; entries: LedgerEntry[] | null }> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-topup:${input.intentId}`}))`,
      );
      const [current] = await tx
        .select()
        .from(walletTopupIntents)
        .where(eq(walletTopupIntents.id, input.intentId))
        .limit(1)
        .for("update");
      if (!current) throw new AppError("Top-up intent not found", 404, "TOPUP_NOT_FOUND");
      if (current.status === "succeeded") {
        if (
          current.providerEventId === input.providerEventId &&
          current.ledgerBatchId === input.ledgerBatchId
        ) {
          return { intent: toIntent(current), entries: null };
        }
        throw new AppError("Top-up intent already credited", 409, "TOPUP_ALREADY_CREDITED");
      }
      if (current.status !== "awaiting_provider" && current.status !== "created") {
        throw new AppError("Top-up intent cannot be credited", 409, "TOPUP_INTENT_STATE");
      }
      const posted = await postLedgerBatchInTransaction(tx, input.ledgerBatchId, input.entries);
      const [row] = await tx
        .update(walletTopupIntents)
        .set({
          status: "succeeded",
          providerEventId: input.providerEventId,
          ledgerBatchId: input.ledgerBatchId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletTopupIntents.id, input.intentId),
            eq(walletTopupIntents.status, current.status),
          ),
        )
        .returning();
      if (!row) throw new AppError("Top-up intent credit raced", 409, "TOPUP_CREDIT_RACE");
      return { intent: toIntent(row), entries: posted };
    });
  }

  async markFailed(intentId: string, providerEventId: string): Promise<TopUpIntent> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`wallet-topup:${intentId}`}))`);
      const [current] = await tx
        .select()
        .from(walletTopupIntents)
        .where(eq(walletTopupIntents.id, intentId))
        .limit(1)
        .for("update");
      if (!current) throw new AppError("Top-up intent not found", 404, "TOPUP_NOT_FOUND");
      if (current.status === "succeeded") {
        throw new AppError("Succeeded top-up cannot fail", 409, "TOPUP_INTENT_STATE");
      }
      if (current.status === "failed" && current.providerEventId === providerEventId) {
        return toIntent(current);
      }
      const [row] = await tx
        .update(walletTopupIntents)
        .set({
          status: "failed",
          providerEventId,
          updatedAt: new Date(),
        })
        .where(eq(walletTopupIntents.id, intentId))
        .returning();
      if (!row) throw new AppError("Top-up intent fail update missed", 409, "TOPUP_FAIL_RACE");
      return toIntent(row);
    });
  }

  /**
   * Ops-expire stale awaiting/created top-ups as failed (no ledger posting).
   * Provider never credited; marks them failed with a deterministic expire event id.
   */
  /** Read-only count of top-ups the next expireStaleAwaiting batch would process. */
  async countEligibleStaleAwaiting(input: {
    olderThanIso: string;
    limit?: number;
  }): Promise<number> {
    const olderThan = new Date(input.olderThanIso);
    if (!Number.isFinite(olderThan.getTime())) {
      throw new AppError("Stale intent timestamp is invalid", 400, "WALLET_INTENT_STALE_INVALID");
    }
    const bounded = Math.min(
      Math.max(Number.isSafeInteger(input.limit) ? (input.limit as number) : 20, 1),
      50,
    );
    const rows = await db
      .select({ id: walletTopupIntents.id })
      .from(walletTopupIntents)
      .where(
        and(
          inArray(walletTopupIntents.status, ["created", "awaiting_provider"]),
          lte(walletTopupIntents.createdAt, olderThan),
        ),
      )
      .orderBy(asc(walletTopupIntents.createdAt), asc(walletTopupIntents.id))
      .limit(bounded);
    return rows.length;
  }

  async expireStaleAwaiting(input: {
    olderThanIso: string;
    limit?: number;
  }): Promise<TopUpIntent[]> {
    const olderThan = new Date(input.olderThanIso);
    if (!Number.isFinite(olderThan.getTime())) {
      throw new AppError("Stale intent timestamp is invalid", 400, "WALLET_INTENT_STALE_INVALID");
    }
    const bounded = Math.min(
      Math.max(Number.isSafeInteger(input.limit) ? (input.limit as number) : 20, 1),
      50,
    );
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      const candidates = await tx
        .select()
        .from(walletTopupIntents)
        .where(
          and(
            inArray(walletTopupIntents.status, ["created", "awaiting_provider"]),
            lte(walletTopupIntents.createdAt, olderThan),
          ),
        )
        .orderBy(asc(walletTopupIntents.createdAt), asc(walletTopupIntents.id))
        .limit(bounded)
        .for("update");
      const expired: TopUpIntent[] = [];
      const now = new Date();
      for (const current of candidates) {
        const providerEventId = `ops_expire_${current.id}`;
        const [row] = await tx
          .update(walletTopupIntents)
          .set({
            status: "failed",
            providerEventId,
            updatedAt: now,
          })
          .where(
            and(
              eq(walletTopupIntents.id, current.id),
              inArray(walletTopupIntents.status, ["created", "awaiting_provider"]),
            ),
          )
          .returning();
        if (row) expired.push(toIntent(row));
      }
      return expired;
    });
  }

  /** Cancel an awaiting/created top-up before a verified provider credit. No ledger posting. */
  async cancelAwaiting(input: { intentId: string; accountId: string }): Promise<TopUpIntent> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-topup:${input.intentId}`}))`,
      );
      const [current] = await tx
        .select()
        .from(walletTopupIntents)
        .where(eq(walletTopupIntents.id, input.intentId))
        .limit(1)
        .for("update");
      if (!current) throw new AppError("Top-up intent not found", 404, "TOPUP_NOT_FOUND");
      if (current.accountId !== input.accountId) {
        throw new AppError("Top-up intent account mismatch", 403, "FORBIDDEN");
      }
      if (current.status === "cancelled") return toIntent(current);
      if (current.status !== "awaiting_provider" && current.status !== "created") {
        throw new AppError("Top-up intent cannot be cancelled", 409, "TOPUP_INTENT_STATE");
      }
      const [row] = await tx
        .update(walletTopupIntents)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletTopupIntents.id, input.intentId),
            eq(walletTopupIntents.status, current.status),
          ),
        )
        .returning();
      if (!row) throw new AppError("Top-up cancel raced", 409, "TOPUP_CANCEL_RACE");
      return toIntent(row);
    });
  }
}

export const walletTopupRepository = new WalletTopupRepository();
