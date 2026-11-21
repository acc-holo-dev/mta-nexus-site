import {
  AppError,
  assertEscrowAccountId,
  assertWalletAccountId,
  assertWalletAmount,
  assertWalletCurrency,
  type LedgerEntry,
  type LedgerPosting,
  type PaymentProviderId,
  type WalletCurrency,
  type WithdrawalIntent,
  type WithdrawalIntentStatus,
} from "@nexus/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { ledgerEntries, walletWithdrawalIntents } from "../schema";
import { postLedgerBatchInTransaction } from "./ledger-posting";

type WithdrawalRow = typeof walletWithdrawalIntents.$inferSelect;

function toIntent(row: WithdrawalRow): WithdrawalIntent {
  return {
    id: row.id,
    accountId: row.accountId,
    amount: row.amount,
    currency: row.currency as WalletCurrency,
    providerId: row.providerId as PaymentProviderId,
    status: row.status as WithdrawalIntentStatus,
    idempotencyKey: row.idempotencyKey,
    providerSessionId: row.providerSessionId,
    escrowAccountId: row.escrowAccountId,
    createdAt: row.createdAt.toISOString(),
  };
}

async function balanceInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  accountId: string,
  currency: string,
): Promise<number> {
  const [row] = await tx
    .select({
      balance: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int`,
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.accountId, accountId), eq(ledgerEntries.currency, currency)));
  return Number(row?.balance ?? 0);
}

export class WalletWithdrawalRepository {
  async findById(id: string): Promise<WithdrawalIntent | null> {
    const [row] = await db
      .select()
      .from(walletWithdrawalIntents)
      .where(eq(walletWithdrawalIntents.id, id))
      .limit(1);
    return row ? toIntent(row) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<WithdrawalIntent | null> {
    const [row] = await db
      .select()
      .from(walletWithdrawalIntents)
      .where(eq(walletWithdrawalIntents.idempotencyKey, idempotencyKey))
      .limit(1);
    return row ? toIntent(row) : null;
  }

  async listRecentByAccount(accountId: string, limit = 20): Promise<WithdrawalIntent[]> {
    assertWalletAccountId(accountId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError(
        "Withdrawal history limit is invalid",
        400,
        "WITHDRAWAL_HISTORY_LIMIT_INVALID",
      );
    }
    const rows = await db
      .select()
      .from(walletWithdrawalIntents)
      .where(eq(walletWithdrawalIntents.accountId, accountId))
      .orderBy(desc(walletWithdrawalIntents.createdAt), desc(walletWithdrawalIntents.id))
      .limit(limit);
    return rows.map(toIntent);
  }

  /**
   * Persist awaiting withdrawal and hold available balance in one transaction.
   */
  async insertHoldAwaiting(input: {
    intent: WithdrawalIntent;
    holdLedgerBatchId: string;
    holdEntries: LedgerPosting[];
  }): Promise<WithdrawalIntent> {
    const { intent } = input;
    assertWalletAccountId(intent.accountId);
    assertEscrowAccountId(intent.escrowAccountId);
    assertWalletAmount(intent.amount);
    assertWalletCurrency(intent.currency);
    if (intent.status !== "awaiting_provider" || !intent.providerSessionId) {
      throw new AppError(
        "Withdrawal intent is not ready to persist",
        400,
        "WITHDRAWAL_INTENT_STATE",
      );
    }

    try {
      return await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`wallet-withdraw:${intent.id}`}))`,
        );
        const available = await balanceInTransaction(tx, intent.accountId, intent.currency);
        if (available < intent.amount) {
          throw new AppError(
            "Available wallet balance is insufficient",
            409,
            "WALLET_INSUFFICIENT_FUNDS",
          );
        }
        await postLedgerBatchInTransaction(tx, input.holdLedgerBatchId, input.holdEntries);
        const [row] = await tx
          .insert(walletWithdrawalIntents)
          .values({
            id: intent.id,
            accountId: intent.accountId,
            amount: intent.amount,
            currency: intent.currency,
            providerId: intent.providerId,
            status: intent.status,
            idempotencyKey: intent.idempotencyKey,
            providerSessionId: intent.providerSessionId,
            escrowAccountId: intent.escrowAccountId,
            holdLedgerBatchId: input.holdLedgerBatchId,
            createdAt: new Date(intent.createdAt),
            updatedAt: new Date(),
          })
          .returning();
        if (!row) {
          throw new AppError("Withdrawal intent insert failed", 409, "WITHDRAWAL_INSERT_FAILED");
        }
        return toIntent(row);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const existing = await this.findByIdempotencyKey(intent.idempotencyKey);
      if (existing) {
        if (
          existing.accountId !== intent.accountId ||
          existing.amount !== intent.amount ||
          existing.currency !== intent.currency ||
          existing.providerId !== intent.providerId
        ) {
          throw new AppError(
            "Withdrawal idempotency key already used",
            409,
            "WITHDRAWAL_IDEMPOTENCY_CONFLICT",
          );
        }
        return existing;
      }
      throw error;
    }
  }

  async settleVerified(input: {
    intentId: string;
    providerEventId: string;
    settleLedgerBatchId: string;
    entries: LedgerPosting[];
  }): Promise<{ intent: WithdrawalIntent; entries: LedgerEntry[] | null }> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-withdraw:${input.intentId}`}))`,
      );
      const [current] = await tx
        .select()
        .from(walletWithdrawalIntents)
        .where(eq(walletWithdrawalIntents.id, input.intentId))
        .limit(1)
        .for("update");
      if (!current) throw new AppError("Withdrawal intent not found", 404, "WITHDRAWAL_NOT_FOUND");
      if (current.status === "succeeded") {
        if (
          current.providerEventId === input.providerEventId &&
          current.settleLedgerBatchId === input.settleLedgerBatchId
        ) {
          return { intent: toIntent(current), entries: null };
        }
        throw new AppError("Withdrawal already paid out", 409, "WITHDRAWAL_ALREADY_PAID");
      }
      if (current.status !== "awaiting_provider") {
        throw new AppError("Withdrawal intent cannot be paid out", 409, "WITHDRAWAL_INTENT_STATE");
      }
      const posted = await postLedgerBatchInTransaction(
        tx,
        input.settleLedgerBatchId,
        input.entries,
      );
      const [row] = await tx
        .update(walletWithdrawalIntents)
        .set({
          status: "succeeded",
          providerEventId: input.providerEventId,
          settleLedgerBatchId: input.settleLedgerBatchId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletWithdrawalIntents.id, input.intentId),
            eq(walletWithdrawalIntents.status, "awaiting_provider"),
          ),
        )
        .returning();
      if (!row) throw new AppError("Withdrawal settle raced", 409, "WITHDRAWAL_SETTLE_RACE");
      return { intent: toIntent(row), entries: posted };
    });
  }

  async failVerified(input: {
    intentId: string;
    providerEventId: string;
    settleLedgerBatchId: string;
    entries: LedgerPosting[];
  }): Promise<{ intent: WithdrawalIntent; entries: LedgerEntry[] | null }> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-withdraw:${input.intentId}`}))`,
      );
      const [current] = await tx
        .select()
        .from(walletWithdrawalIntents)
        .where(eq(walletWithdrawalIntents.id, input.intentId))
        .limit(1)
        .for("update");
      if (!current) throw new AppError("Withdrawal intent not found", 404, "WITHDRAWAL_NOT_FOUND");
      if (current.status === "succeeded") {
        throw new AppError("Succeeded withdrawal cannot fail", 409, "WITHDRAWAL_INTENT_STATE");
      }
      if (current.status === "failed" && current.providerEventId === input.providerEventId) {
        return { intent: toIntent(current), entries: null };
      }
      if (current.status !== "awaiting_provider") {
        throw new AppError("Withdrawal intent cannot fail", 409, "WITHDRAWAL_INTENT_STATE");
      }
      const posted = await postLedgerBatchInTransaction(
        tx,
        input.settleLedgerBatchId,
        input.entries,
      );
      const [row] = await tx
        .update(walletWithdrawalIntents)
        .set({
          status: "failed",
          providerEventId: input.providerEventId,
          settleLedgerBatchId: input.settleLedgerBatchId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletWithdrawalIntents.id, input.intentId),
            eq(walletWithdrawalIntents.status, "awaiting_provider"),
          ),
        )
        .returning();
      if (!row) throw new AppError("Withdrawal fail raced", 409, "WITHDRAWAL_FAIL_RACE");
      return { intent: toIntent(row), entries: posted };
    });
  }

  /** Cancel an awaiting withdrawal and return escrow to available balance. */
  async cancelAwaiting(input: {
    intentId: string;
    accountId: string;
    settleLedgerBatchId: string;
    entries: LedgerPosting[];
  }): Promise<{ intent: WithdrawalIntent; entries: LedgerEntry[] | null }> {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-withdraw:${input.intentId}`}))`,
      );
      const [current] = await tx
        .select()
        .from(walletWithdrawalIntents)
        .where(eq(walletWithdrawalIntents.id, input.intentId))
        .limit(1)
        .for("update");
      if (!current) throw new AppError("Withdrawal intent not found", 404, "WITHDRAWAL_NOT_FOUND");
      if (current.accountId !== input.accountId) {
        throw new AppError("Withdrawal intent account mismatch", 403, "FORBIDDEN");
      }
      if (current.status === "cancelled") {
        return { intent: toIntent(current), entries: null };
      }
      if (current.status !== "awaiting_provider") {
        throw new AppError("Withdrawal intent cannot be cancelled", 409, "WITHDRAWAL_INTENT_STATE");
      }
      const posted = await postLedgerBatchInTransaction(
        tx,
        input.settleLedgerBatchId,
        input.entries,
      );
      const [row] = await tx
        .update(walletWithdrawalIntents)
        .set({
          status: "cancelled",
          settleLedgerBatchId: input.settleLedgerBatchId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(walletWithdrawalIntents.id, input.intentId),
            eq(walletWithdrawalIntents.status, "awaiting_provider"),
          ),
        )
        .returning();
      if (!row) throw new AppError("Withdrawal cancel raced", 409, "WITHDRAWAL_CANCEL_RACE");
      return { intent: toIntent(row), entries: posted };
    });
  }
}

export const walletWithdrawalRepository = new WalletWithdrawalRepository();
