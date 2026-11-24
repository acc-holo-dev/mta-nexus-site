import { createHash } from "node:crypto";
import { AppError, type ExplicitFxRate, type WalletCurrency } from "@nexus/domain";
import { db } from "../client";
import { walletFxRates } from "../schema";

function mapRate(row: typeof walletFxRates.$inferSelect): ExplicitFxRate {
  return {
    baseCurrency: row.baseCurrency as WalletCurrency,
    quoteCurrency: row.quoteCurrency as WalletCurrency,
    baseAmount: row.baseAmount,
    quoteAmount: row.quoteAmount,
  };
}

export class WalletFxRateRepository {
  async list(): Promise<ExplicitFxRate[]> {
    const rows = await db.select().from(walletFxRates);
    return rows.map(mapRate);
  }

  async save(input: ExplicitFxRate & { actorId: string }): Promise<ExplicitFxRate> {
    const id = `fxr_${createHash("sha256")
      .update(`${input.baseCurrency}:${input.quoteCurrency}`)
      .digest("hex")
      .slice(0, 24)}`;
    const now = new Date();
    const [row] = await db
      .insert(walletFxRates)
      .values({
        id,
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        baseAmount: input.baseAmount,
        quoteAmount: input.quoteAmount,
        updatedBy: input.actorId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: walletFxRates.id,
        set: {
          baseAmount: input.baseAmount,
          quoteAmount: input.quoteAmount,
          updatedBy: input.actorId,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new AppError("Exchange rate was not recorded", 409, "FX_INVALID");
    return mapRate(row);
  }
}

export const walletFxRateRepository = new WalletFxRateRepository();
