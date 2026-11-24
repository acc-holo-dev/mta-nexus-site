import { createHash } from "node:crypto";
import { AppError, normalizePromoCode, type PromoCodeRecord } from "@nexus/domain";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { promoCodes, promoRedemptions } from "../schema";

function mapPromo(row: typeof promoCodes.$inferSelect): PromoCodeRecord {
  return {
    code: row.code,
    kind: row.kind,
    percent: row.percent,
    amount: row.amount,
    currency: row.currency,
    active: row.active,
    maxRedemptions: row.maxRedemptions,
    redemptionCount: row.redemptionCount,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  };
}

export class PromoCodeRepository {
  async findByCode(code: string): Promise<PromoCodeRecord | null> {
    const normalized = normalizePromoCode(code);
    const [row] = await db
      .select()
      .from(promoCodes)
      .where(eq(promoCodes.code, normalized))
      .limit(1);
    return row ? mapPromo(row) : null;
  }

  async buyerHasRedeemed(buyerId: string, code: string): Promise<boolean> {
    const normalized = normalizePromoCode(code);
    const [row] = await db
      .select({ orderId: promoRedemptions.orderId })
      .from(promoRedemptions)
      .where(and(eq(promoRedemptions.buyerId, buyerId), eq(promoRedemptions.code, normalized)))
      .limit(1);
    return Boolean(row);
  }

  async create(input: {
    actorId: string;
    code: string;
    kind: "percent" | "fixed";
    percent: number | null;
    amount: number | null;
    currency: string | null;
    maxRedemptions: number | null;
  }): Promise<PromoCodeRecord> {
    const code = normalizePromoCode(input.code);
    const id = `prm_${createHash("sha256").update(code).digest("hex").slice(0, 24)}`;
    try {
      const [row] = await db
        .insert(promoCodes)
        .values({
          id,
          code,
          kind: input.kind,
          percent: input.percent,
          amount: input.amount,
          currency: input.currency,
          active: true,
          maxRedemptions: input.maxRedemptions,
          redemptionCount: 0,
          createdBy: input.actorId,
        })
        .returning();
      if (!row) throw new AppError("Promo code was not recorded", 409, "PROMO_INVALID");
      return mapPromo(row);
    } catch (error) {
      const cause = error && typeof error === "object" && "cause" in error ? error.cause : error;
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") {
        throw new AppError("Promo code already exists", 409, "PROMO_CODE_TAKEN");
      }
      throw error;
    }
  }
}

export const promoCodeRepository = new PromoCodeRepository();

type PromoTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Serialize redemption of one code inside the caller's transaction. */
export async function lockPromoCode(tx: PromoTx, code: string): Promise<PromoCodeRecord | null> {
  const normalized = normalizePromoCode(code);
  const [row] = await tx
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, normalized))
    .limit(1)
    .for("update");
  return row ? mapPromo(row) : null;
}

export async function redeemLockedPromo(
  tx: PromoTx,
  input: {
    code: string;
    buyerId: string;
    orderId: string;
    listAmount: number;
    discountAmount: number;
    chargedAmount: number;
    currency: string;
  },
): Promise<void> {
  const [updated] = await tx
    .update(promoCodes)
    .set({ redemptionCount: sql`${promoCodes.redemptionCount} + 1` })
    .where(
      and(
        eq(promoCodes.code, input.code),
        sql`${promoCodes.maxRedemptions} IS NULL OR ${promoCodes.redemptionCount} < ${promoCodes.maxRedemptions}`,
      ),
    )
    .returning({ code: promoCodes.code });
  if (!updated) throw new AppError("Promo code is exhausted", 409, "PROMO_EXHAUSTED");
  try {
    await tx.insert(promoRedemptions).values({
      orderId: input.orderId,
      code: input.code,
      buyerId: input.buyerId,
      listAmount: input.listAmount,
      discountAmount: input.discountAmount,
      chargedAmount: input.chargedAmount,
      currency: input.currency,
    });
  } catch (error) {
    const cause = error && typeof error === "object" && "cause" in error ? error.cause : error;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505") {
      throw new AppError("Promo code was already used", 409, "PROMO_ALREADY_USED");
    }
    throw error;
  }
}
