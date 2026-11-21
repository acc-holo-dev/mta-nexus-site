import { createHash } from "node:crypto";
import {
  AppError,
  type LedgerEntry,
  type LedgerPosting,
  validateLedgerPosting,
} from "@nexus/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { ledgerEntries } from "../schema";
import { postLedgerBatchInTransaction } from "./ledger-posting";

const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class LedgerRepository {
  /** Internal accounting only: never changes order/payment/entitlement states. */
  async post(idempotencyKey: string, entries: LedgerPosting[]): Promise<LedgerEntry[]> {
    validateLedgerPosting(entries);
    return db.transaction(async (tx) => postLedgerBatchInTransaction(tx, idempotencyKey, entries));
  }

  async append(entries: Omit<LedgerEntry, "createdAt">[]) {
    // Old callers' cached balances are deliberately ignored; PostgreSQL computes them.
    return this.post(`jrn_${fingerprint(entries.map((e) => e.id).sort())}`, entries);
  }

  async listRecent(limit = 20): Promise<LedgerEntry[]> {
    return db
      .select()
      .from(ledgerEntries)
      .orderBy(desc(ledgerEntries.createdAt), desc(ledgerEntries.id))
      .limit(Math.min(Math.max(Number.isSafeInteger(limit) ? limit : 20, 1), 100)) as Promise<
      LedgerEntry[]
    >;
  }

  /** Recent journal lines for one account+currency (wallet activity / spend history). */
  async listRecentByAccount(
    accountId: string,
    currency: string,
    limit = 20,
  ): Promise<LedgerEntry[]> {
    if (!["USD", "EUR", "RUB"].includes(currency))
      throw new AppError("Choose a ledger currency", 400, "LEDGER_CURRENCY_REQUIRED");
    if (typeof accountId !== "string" || accountId.length < 3 || accountId.length > 160) {
      throw new AppError("Ledger account is invalid", 400, "LEDGER_ACCOUNT_INVALID");
    }
    const bounded = Math.min(Math.max(Number.isSafeInteger(limit) ? limit : 20, 1), 100);
    return db
      .select()
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.accountId, accountId), eq(ledgerEntries.currency, currency)))
      .orderBy(desc(ledgerEntries.createdAt), desc(ledgerEntries.id))
      .limit(bounded) as Promise<LedgerEntry[]>;
  }

  async getAccountBalance(accountId: string, currency: string): Promise<number> {
    if (!["USD", "EUR", "RUB"].includes(currency))
      throw new AppError("Choose a ledger currency", 400, "LEDGER_CURRENCY_REQUIRED");
    const rows = await db
      .select({ amount: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)::text` })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.accountId, accountId), eq(ledgerEntries.currency, currency)));
    const balance = Number(rows[0]?.amount ?? 0);
    if (!Number.isSafeInteger(balance))
      throw new AppError("Ledger balance exceeds supported range", 409, "LEDGER_BALANCE_RANGE");
    return balance;
  }
}

export const ledgerRepository = new LedgerRepository();
