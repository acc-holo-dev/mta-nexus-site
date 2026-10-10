import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { AppError, validateLedgerPosting, type LedgerEntry, type LedgerPosting } from "@nexus/domain";
import { db } from "../client";
import { ledgerEntries, ledgerPostingBatches as batches, orders } from "../schema";
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class LedgerRepository {
  /** Internal accounting only: never changes order/payment/entitlement states. */
  async post(idempotencyKey: string, entries: LedgerPosting[]): Promise<LedgerEntry[]> {
    validateLedgerPosting(entries);
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(idempotencyKey)) throw new AppError("Invalid posting key", 400, "LEDGER_POSTING_INVALID");
    const canonical = entries.map(e => ({ id: e.id, accountId: e.accountId, amount: e.amount, currency: e.currency, referenceType: e.referenceType, referenceId: e.referenceId, description: e.description })).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const digest = fingerprint(canonical);
    return db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ledger-batch:${idempotencyKey}`}))`);
      const [existing] = await tx.select({ fingerprint: batches.fingerprint }).from(batches).where(eq(batches.id, idempotencyKey)).limit(1).for("share");
      if (existing) {
        if (existing.fingerprint !== digest) throw new AppError("Posting key already used", 409, "LEDGER_REQUEST_CONFLICT");
        return tx.select().from(ledgerEntries).where(eq(ledgerEntries.batchId, idempotencyKey)).orderBy(asc(ledgerEntries.id)) as Promise<LedgerEntry[]>;
      }
      const references = [...new Set(canonical.map(e => e.referenceId))].sort();
      const referencedOrders = await tx.select({ id: orders.id, status: orders.status }).from(orders).where(inArray(orders.id, references)).orderBy(asc(orders.id)).for("no key update");
      if (referencedOrders.some(order => order.status === "cancelled") || canonical.some(e => e.referenceType === "order" && !referencedOrders.some(order => order.id === e.referenceId))) throw new AppError("Order cannot accept posting", 409, "ORDER_NOT_PAYABLE");
      const accounts = [...new Set(canonical.map(e => `${e.accountId}:${e.currency}`))].sort();
      for (const account of accounts) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ledger-account:${account}`}))`);
      await tx.insert(batches).values({ id: idempotencyKey, fingerprint: digest });
      const records: LedgerEntry[] = [];
      for (const entry of canonical) {
        const [record] = await tx.insert(ledgerEntries).values({ ...entry, batchId: idempotencyKey, balanceAfter: 0 }).returning();
        if (!record) throw new AppError("Posting failed", 409, "LEDGER_POSTING_FAILED");
        records.push(record as LedgerEntry);
      }
      return records;
    });
  }
  async append(entries: Omit<LedgerEntry, "createdAt">[]) {
    // Old callers' cached balances are deliberately ignored; PostgreSQL computes them.
    return this.post(`jrn_${fingerprint(entries.map(e => e.id).sort())}`, entries);
  }
  async listRecent(limit = 20): Promise<LedgerEntry[]> {
    return db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt), desc(ledgerEntries.id)).limit(Math.min(Math.max(Number.isSafeInteger(limit) ? limit : 20, 1), 100)) as Promise<LedgerEntry[]>;
  }
  async getAccountBalance(accountId: string, currency: string): Promise<number> {
    if (!["USD", "EUR", "RUB"].includes(currency)) throw new AppError("Choose a ledger currency", 400, "LEDGER_CURRENCY_REQUIRED");
    const rows = await db.select({ amount: sql<string>`coalesce(sum(${ledgerEntries.amount}), 0)::text` }).from(ledgerEntries).where(and(eq(ledgerEntries.accountId, accountId), eq(ledgerEntries.currency, currency)));
    const balance = Number(rows[0]?.amount ?? 0);
    if (!Number.isSafeInteger(balance)) throw new AppError("Ledger balance exceeds supported range", 409, "LEDGER_BALANCE_RANGE");
    return balance;
  }
}
export const ledgerRepository = new LedgerRepository();
