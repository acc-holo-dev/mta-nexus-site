import { expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, ledgerEntries, ledgerPostingBatches } from "@nexus/db";
it("enforces exact balances, immutability and per-currency deferred balance in PostgreSQL", async () => {
  const suffix = `${Date.now()}_${process.pid}`,
    rollback = new Error("fixture rollback");
  await db
    .transaction(async (tx) => {
      const id = `jrn_fixture_${suffix}`;
      await tx.insert(ledgerPostingBatches).values({ id, fingerprint: "a".repeat(64) });
      const [credit] = await tx
        .insert(ledgerEntries)
        .values({
          id: `leg_credit_${suffix}`,
          batchId: id,
          accountId: `user:fixture_${suffix}`,
          amount: 100,
          currency: "USD",
          referenceType: "fee",
          referenceId: `fixture_${suffix}`,
          balanceAfter: 999,
          description: "Fixture credit",
        })
        .returning();
      await tx
        .insert(ledgerEntries)
        .values({
          id: `leg_debit_${suffix}`,
          batchId: id,
          accountId: `platform:fixture_${suffix}`,
          amount: -100,
          currency: "USD",
          referenceType: "fee",
          referenceId: `fixture_${suffix}`,
          balanceAfter: 999,
          description: "Fixture debit",
        });
      expect(credit.balanceAfter).toBe(100);
      await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
      await expect(
        tx.transaction(async (nested) => {
          await nested
            .update(ledgerEntries)
            .set({ amount: 1 })
            .where(eq(ledgerEntries.id, credit.id));
        }),
      ).rejects.toBeTruthy();
      await expect(
        tx.transaction(async (nested) => {
          await nested.delete(ledgerPostingBatches).where(eq(ledgerPostingBatches.id, id));
        }),
      ).rejects.toBeTruthy();
      await expect(
        tx.transaction(async (nested) => {
          await nested.execute(sql`SET CONSTRAINTS ALL DEFERRED`);
          const badId = `jrn_bad_${suffix}`;
          await nested
            .insert(ledgerPostingBatches)
            .values({ id: badId, fingerprint: "b".repeat(64) });
          await nested.insert(ledgerEntries).values([
            {
              id: `leg_bad_usd_${suffix}`,
              batchId: badId,
              accountId: `platform:bad_${suffix}`,
              amount: 100,
              currency: "USD",
              referenceType: "fee",
              referenceId: `fixture_${suffix}`,
              balanceAfter: 0,
              description: "Invalid credit",
            },
            {
              id: `leg_bad_eur_${suffix}`,
              batchId: badId,
              accountId: `platform:bad_${suffix}`,
              amount: -100,
              currency: "EUR",
              referenceType: "fee",
              referenceId: `fixture_${suffix}`,
              balanceAfter: 0,
              description: "Invalid debit",
            },
          ]);
          await nested.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
        }),
      ).rejects.toBeTruthy();
      throw rollback;
    })
    .catch((error) => {
      if (error !== rollback) throw error;
    });
});
