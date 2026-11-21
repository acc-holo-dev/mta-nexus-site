import {
  AppError,
  buildWalletHoldReleasePosting,
  type WalletCurrency,
  type WalletSellerHold,
  walletHoldReleaseAt,
} from "@nexus/domain";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { walletSellerHolds } from "../schema";
import { postLedgerBatchInTransaction } from "./ledger-posting";

function mapHold(row: typeof walletSellerHolds.$inferSelect): WalletSellerHold {
  return {
    id: row.id,
    orderId: row.orderId,
    sellerAccountId: row.sellerAccountId,
    escrowAccountId: row.escrowAccountId,
    amount: row.amount,
    currency: row.currency as WalletCurrency,
    status: row.status as WalletSellerHold["status"],
    heldAt: row.heldAt.toISOString(),
    releaseAt: row.releaseAt.toISOString(),
    holdLedgerBatchId: row.holdLedgerBatchId,
    releaseLedgerBatchId: row.releaseLedgerBatchId,
  };
}

export class WalletSellerHoldRepository {
  async listHeldBySeller(sellerAccountId: string, limit = 20): Promise<WalletSellerHold[]> {
    const bounded = Math.min(Math.max(Number.isSafeInteger(limit) ? limit : 20, 1), 100);
    const rows = await db
      .select()
      .from(walletSellerHolds)
      .where(
        and(
          eq(walletSellerHolds.sellerAccountId, sellerAccountId),
          eq(walletSellerHolds.status, "held"),
        ),
      )
      .orderBy(asc(walletSellerHolds.releaseAt), asc(walletSellerHolds.id))
      .limit(bounded);
    return rows.map(mapHold);
  }

  async sumHeldBySeller(sellerAccountId: string, currency: WalletCurrency): Promise<number> {
    const [row] = await db
      .select({
        total: sql<string>`coalesce(sum(${walletSellerHolds.amount}), 0)::text`,
      })
      .from(walletSellerHolds)
      .where(
        and(
          eq(walletSellerHolds.sellerAccountId, sellerAccountId),
          eq(walletSellerHolds.status, "held"),
          eq(walletSellerHolds.currency, currency),
        ),
      );
    const total = Number(row?.total ?? 0);
    if (!Number.isSafeInteger(total)) {
      throw new AppError("Held balance exceeds supported range", 409, "WALLET_HOLD_RANGE");
    }
    return total;
  }

  async releaseMaturedForSeller(input: {
    sellerAccountId: string;
    nowIso?: string;
    limit?: number;
  }): Promise<WalletSellerHold[]> {
    return this.releaseMatured({
      sellerAccountId: input.sellerAccountId,
      nowIso: input.nowIso,
      limit: input.limit,
    });
  }

  /**
   * Release matured holds across sellers (operator/admin batch).
   * Same ledger posting as the seller-scoped path; limited per invocation.
   */
  async releaseMaturedBatch(input: {
    nowIso?: string;
    limit?: number;
  }): Promise<WalletSellerHold[]> {
    return this.releaseMatured({
      nowIso: input.nowIso,
      limit: input.limit,
    });
  }

  private async releaseMatured(input: {
    sellerAccountId?: string;
    nowIso?: string;
    limit?: number;
  }): Promise<WalletSellerHold[]> {
    const nowIso = input.nowIso ?? new Date().toISOString();
    const now = new Date(nowIso);
    if (!Number.isFinite(now.getTime())) {
      throw new AppError("Hold timestamp is invalid", 400, "WALLET_HOLD_INVALID");
    }
    const requestedLimit = input.limit;
    const bounded = Math.min(
      Math.max(Number.isSafeInteger(requestedLimit) ? (requestedLimit as number) : 20, 1),
      50,
    );

    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      const predicates = [
        eq(walletSellerHolds.status, "held"),
        lte(walletSellerHolds.releaseAt, now),
      ];
      if (input.sellerAccountId) {
        predicates.unshift(eq(walletSellerHolds.sellerAccountId, input.sellerAccountId));
      }
      const candidates = await tx
        .select()
        .from(walletSellerHolds)
        .where(and(...predicates))
        .orderBy(asc(walletSellerHolds.releaseAt), asc(walletSellerHolds.id))
        .limit(bounded)
        .for("update");

      const released: WalletSellerHold[] = [];
      for (const row of candidates) {
        const hold = mapHold(row);
        const releaseBatchId = `whold_rel_${hold.id}`;
        const posting = buildWalletHoldReleasePosting({
          hold,
          escrowEntryId: `ldg_whold_${hold.id}_esc`,
          sellerEntryId: `ldg_whold_${hold.id}_sel`,
          nowIso,
        });
        await postLedgerBatchInTransaction(tx, releaseBatchId, posting);
        const [updated] = await tx
          .update(walletSellerHolds)
          .set({
            status: "released",
            releaseLedgerBatchId: releaseBatchId,
            updatedAt: now,
          })
          .where(and(eq(walletSellerHolds.id, hold.id), eq(walletSellerHolds.status, "held")))
          .returning();
        if (updated) released.push(mapHold(updated));
      }
      return released;
    });
  }
}

export const walletSellerHoldRepository = new WalletSellerHoldRepository();

export { walletHoldReleaseAt };
