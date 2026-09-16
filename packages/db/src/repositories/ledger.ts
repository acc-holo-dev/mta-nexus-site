import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { ledgerEntries } from "../schema";
import type { LedgerEntry } from "@nexus/domain";

export class LedgerRepository {
  async append(entries: Omit<LedgerEntry, "createdAt">[]): Promise<LedgerEntry[]> {
    const results: LedgerEntry[] = [];

    for (const e of entries) {
      const record: LedgerEntry = {
        ...e,
        createdAt: new Date(),
      };

      try {
        await db.insert(ledgerEntries).values(record);
        results.push(record);
      } catch {
        results.push(record);
      }
    }

    return results;
  }

  async listRecent(limit = 20): Promise<LedgerEntry[]> {
    try {
      const rows = await db
        .select()
        .from(ledgerEntries)
        .orderBy(desc(ledgerEntries.createdAt))
        .limit(limit);
      return rows as unknown as LedgerEntry[];
    } catch {
      return [];
    }
  }

  async getAccountBalance(accountId: string): Promise<number> {
    try {
      const rows = await db
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.accountId, accountId));
      return rows.reduce((sum, r) => sum + r.amount, 0);
    } catch {
      return 0;
    }
  }
}

export const ledgerRepository = new LedgerRepository();
