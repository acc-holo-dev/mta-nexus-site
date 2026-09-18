import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { ledgerEntries } from "../schema";
import type { LedgerEntry } from "@nexus/domain";

export class LedgerRepository {
  async append(entries: Omit<LedgerEntry, "createdAt">[]): Promise<LedgerEntry[]> {
    const records: LedgerEntry[] = entries.map((entry) => ({
      ...entry,
      createdAt: new Date(),
    }));

    await db.transaction(async (tx) => {
      for (const record of records) {
        await tx.insert(ledgerEntries).values(record);
      }
    });

    return records;
  }

  async listRecent(limit = 20): Promise<LedgerEntry[]> {
    const rows = await db
      .select()
      .from(ledgerEntries)
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(limit);
    return rows as unknown as LedgerEntry[];
  }

  async getAccountBalance(accountId: string): Promise<number> {
    const rows = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.accountId, accountId));
    return rows.reduce((sum, row) => sum + row.amount, 0);
  }
}

export const ledgerRepository = new LedgerRepository();
