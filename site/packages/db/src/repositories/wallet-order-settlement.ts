import { createHash } from "node:crypto";
import {
  AppError,
  allocateWalletSpendCommission,
  buildWalletOrderRefundPosting,
  buildWalletSpendPosting,
  type LedgerEntry,
  type LedgerPosting,
  NotFoundError,
  quotePromoDiscount,
  type WalletCurrency,
  walletAccountIdForUser,
  walletHoldReleaseAt,
} from "@nexus/domain";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  entitlements,
  ledgerEntries,
  orderItems,
  orders,
  payments,
  products,
  resourceAcquisitionEvents,
  users,
  walletSellerHolds,
} from "../schema";
import { lockInitiatingSession } from "./initiating-session";
import { accountBalanceInTransaction, postLedgerBatchInTransaction } from "./ledger-posting";
import { lockPromoCode, redeemLockedPromo } from "./promo-codes";

export type WalletPurchasedBuild = {
  productId: string;
  buildId: string;
  version: string;
};

export type WalletOrderSettlementResult = {
  orderId: string;
  paymentId: string;
  ledgerBatchId: string;
  status: "completed";
  totalAmount: number;
  currency: WalletCurrency;
  entries: LedgerEntry[];
  alreadySettled: boolean;
  entitlementIds: string[];
  holdIds: string[];
  purchasedBuilds: WalletPurchasedBuild[];
};

export type WalletOrderRefundResult = {
  orderId: string;
  paymentId: string;
  ledgerBatchId: string;
  status: "refunded";
  totalAmount: number;
  currency: WalletCurrency;
  entries: LedgerEntry[];
  alreadyRefunded: boolean;
  cancelledHoldIds: string[];
  clawedBackHoldIds: string[];
  expiredEntitlementIds: string[];
};

function sellerSuffix(sellerAccountId: string): string {
  return createHash("sha256").update(sellerAccountId).digest("hex").slice(0, 16);
}

function walletSettleIds(orderId: string) {
  return {
    paymentId: `pay_wallet_${orderId}`,
    ledgerBatchId: `wspend_${orderId}`,
    userEntryId: `ldg_wspend_${orderId}_user`,
    platformFeeEntryId: `ldg_wspend_${orderId}_fee`,
    promoEntryId: `ldg_wspend_${orderId}_promo`,
    holdEntryId: (sellerAccountId: string) =>
      `ldg_wspend_${orderId}_h_${sellerSuffix(sellerAccountId)}`,
    holdId: (sellerAccountId: string) => `whold_${orderId}_${sellerSuffix(sellerAccountId)}`,
    escrowAccountId: (sellerAccountId: string) =>
      `escrow:wspend_${orderId}_${sellerSuffix(sellerAccountId)}`,
    auditId: `aud_wspend_${orderId}`,
  };
}

function walletRefundIds(orderId: string) {
  return {
    paymentId: `pay_wallet_${orderId}`,
    ledgerBatchId: `wrefund_${orderId}`,
    buyerEntryId: `ldg_wrefund_${orderId}_buyer`,
    platformFeeEntryId: `ldg_wrefund_${orderId}_fee`,
    promoEntryId: `ldg_wrefund_${orderId}_promo`,
    holdEntryId: (holdId: string) => `ldg_wrefund_${orderId}_${holdId}`,
    auditId: `aud_wrefund_${orderId}`,
  };
}

async function lockedPromoForOrder(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  order: {
    id: string;
    buyerId: string;
    totalAmount: number;
    currency: string;
    listAmount: number | null;
    discountAmount: number | null;
    promoCode: string | null;
  },
  lineTotal: number,
): Promise<{ code: string; discountAmount: number } | null> {
  if (!order.promoCode && order.listAmount === null && order.discountAmount === null) return null;
  if (
    !order.promoCode ||
    order.listAmount === null ||
    order.discountAmount === null ||
    order.listAmount !== lineTotal ||
    order.listAmount - order.discountAmount !== order.totalAmount
  ) {
    throw new AppError("Promo terms changed", 409, "PROMO_TERMS_CHANGED");
  }
  const record = await lockPromoCode(tx, order.promoCode);
  if (!record) throw new AppError("Promo code was not found", 404, "PROMO_NOT_FOUND");
  const quote = quotePromoDiscount({
    listAmount: lineTotal,
    currency: order.currency as WalletCurrency,
    promo: record,
    now: new Date(),
  });
  if (
    quote.discountAmount !== order.discountAmount ||
    quote.chargedAmount !== order.totalAmount ||
    quote.currency !== order.currency
  ) {
    throw new AppError("Promo terms changed", 409, "PROMO_TERMS_CHANGED");
  }
  await redeemLockedPromo(tx, {
    code: quote.code,
    buyerId: order.buyerId,
    orderId: order.id,
    listAmount: quote.listAmount,
    discountAmount: quote.discountAmount,
    chargedAmount: quote.chargedAmount,
    currency: quote.currency,
  });
  return { code: quote.code, discountAmount: quote.discountAmount };
}

function sellerAccountForProduct(product: {
  authorId: string;
  organizationId: string | null;
}): string {
  return product.organizationId ? `org:${product.organizationId}` : `user:${product.authorId}`;
}

/**
 * Atomic wallet spend settlement for a pending paid buyer order.
 * Posts wallet_spend (fee + escrow holds), records a completed wallet payment,
 * marks the order completed, inserts seller holds, and grants download entitlements.
 */
export class WalletOrderSettlementRepository {
  async settle(input: {
    buyerId: string;
    currentToken: string;
    orderId: string;
    purchasedBuilds?: readonly WalletPurchasedBuild[];
  }): Promise<WalletOrderSettlementResult> {
    if (!input.currentToken) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(input.orderId))
      throw new AppError("Order id is invalid", 400, "WALLET_ORDER_INVALID");

    const ids = walletSettleIds(input.orderId);

    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-settle:${input.orderId}`}))`,
      );

      const [order] = await tx
        .select({
          id: orders.id,
          buyerId: orders.buyerId,
          status: orders.status,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
          listAmount: orders.listAmount,
          discountAmount: orders.discountAmount,
          promoCode: orders.promoCode,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1)
        .for("update");
      if (!order) throw new NotFoundError("Order", input.orderId);
      if (order.buyerId !== input.buyerId)
        throw new AppError("Order does not belong to buyer", 403, "FORBIDDEN");

      const [buyer] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.buyerId))
        .limit(1)
        .for("share");
      if (!buyer) throw new AppError("Buyer unavailable", 404, "NOT_FOUND");
      await lockInitiatingSession(tx, input.buyerId, input.currentToken);

      const [existingPayment] = await tx
        .select({
          id: payments.id,
          status: payments.status,
          amount: payments.amount,
          currency: payments.currency,
          provider: payments.provider,
          providerTransactionId: payments.providerTransactionId,
        })
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.id, ids.paymentId)))
        .limit(1)
        .for("update");

      if (existingPayment?.status === "completed") {
        if (
          existingPayment.amount !== order.totalAmount ||
          existingPayment.currency !== order.currency ||
          existingPayment.provider !== "wallet" ||
          existingPayment.providerTransactionId !== ids.ledgerBatchId ||
          order.status !== "completed"
        ) {
          throw new AppError("Wallet settlement already recorded", 409, "WALLET_SETTLE_CONFLICT");
        }
        const entries = (await tx
          .select()
          .from(ledgerEntries)
          .where(eq(ledgerEntries.batchId, ids.ledgerBatchId))
          .orderBy(asc(ledgerEntries.id))) as LedgerEntry[];
        return {
          orderId: order.id,
          paymentId: existingPayment.id,
          ledgerBatchId: ids.ledgerBatchId,
          status: "completed" as const,
          totalAmount: order.totalAmount,
          currency: order.currency as WalletCurrency,
          entries,
          alreadySettled: true,
          entitlementIds: [],
          holdIds: [],
          purchasedBuilds: [...(input.purchasedBuilds ?? [])],
        };
      }

      if (order.status !== "pending")
        throw new AppError("Order cannot accept wallet settlement", 409, "ORDER_NOT_PAYABLE");
      if (
        !Number.isSafeInteger(order.totalAmount) ||
        order.totalAmount <= 0 ||
        !["USD", "EUR", "RUB"].includes(order.currency)
      ) {
        throw new AppError(
          "Order is not a paid wallet settlement target",
          409,
          "ORDER_NOT_PAYABLE",
        );
      }
      if (existingPayment)
        throw new AppError("Wallet payment attempt is incomplete", 409, "WALLET_SETTLE_CONFLICT");

      const lines = await tx
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          unitPrice: orderItems.unitPrice,
          currency: orderItems.currency,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.productId));
      if (!lines.length) throw new AppError("Order has no line items", 409, "ORDER_NOT_PAYABLE");

      const catalog = await tx
        .select({
          id: products.id,
          authorId: products.authorId,
          organizationId: products.organizationId,
          price: products.price,
          currency: products.currency,
        })
        .from(products)
        .where(
          inArray(
            products.id,
            lines.map((line) => line.productId),
          ),
        );
      if (catalog.length !== lines.length) {
        throw new AppError("Catalog terms changed", 409, "ORDER_CATALOG_CHANGED");
      }
      const productById = new Map(catalog.map((product) => [product.id, product]));
      const commissionLines: Array<{ grossAmount: number; sellerAccountId: string }> = [];
      let lineTotal = 0;
      for (const line of lines) {
        const product = productById.get(line.productId);
        if (!product) throw new AppError("Catalog terms changed", 409, "ORDER_CATALOG_CHANGED");
        if (
          line.unitPrice !== product.price ||
          line.currency !== product.currency ||
          line.currency !== order.currency ||
          !Number.isSafeInteger(line.unitPrice) ||
          line.unitPrice <= 0
        ) {
          throw new AppError("Catalog terms changed", 409, "ORDER_CATALOG_CHANGED");
        }
        const sellerAccountId = sellerAccountForProduct(product);
        if (sellerAccountId === `user:${input.buyerId}`) {
          throw new AppError("Buyer cannot settle own listing", 409, "WALLET_SPEND_INVALID");
        }
        commissionLines.push({ grossAmount: line.unitPrice, sellerAccountId });
        lineTotal += line.unitPrice;
      }
      const promo = await lockedPromoForOrder(tx, order, lineTotal);
      const fundedTotal = order.totalAmount + (promo?.discountAmount ?? 0);
      if (lineTotal !== fundedTotal) {
        throw new AppError("Order total does not match line items", 409, "ORDER_NOT_PAYABLE");
      }

      const accountId = `user:${input.buyerId}`;
      const currency = order.currency as WalletCurrency;
      const availableBalance = await accountBalanceInTransaction(tx, accountId, currency);
      const split = allocateWalletSpendCommission({
        lines: commissionLines,
        currency,
      });
      const sellerHolds = split.sellerCredits
        .filter((credit) => credit.amount > 0)
        .map((credit) => ({
          sellerAccountId: credit.accountId,
          escrowAccountId: ids.escrowAccountId(credit.accountId),
          amount: credit.amount,
          entryId: ids.holdEntryId(credit.accountId),
          holdId: ids.holdId(credit.accountId),
        }));
      if (sellerHolds.length === 0 && split.platformFee !== fundedTotal) {
        throw new AppError("Wallet spend split does not balance", 400, "WALLET_SPEND_INVALID");
      }
      const posting: LedgerPosting[] = buildWalletSpendPosting({
        accountId,
        amount: order.totalAmount,
        currency,
        orderId: order.id,
        availableBalance,
        userEntryId: ids.userEntryId,
        platformFeeEntryId: ids.platformFeeEntryId,
        platformFee: split.platformFee,
        sellerHolds,
        ...(promo
          ? {
              promoFunding: {
                amount: promo.discountAmount,
                entryId: ids.promoEntryId,
                code: promo.code,
              },
            }
          : {}),
      });
      const entries = await postLedgerBatchInTransaction(tx, ids.ledgerBatchId, posting);

      const now = new Date();
      const heldAtIso = now.toISOString();
      const releaseAt = new Date(walletHoldReleaseAt(heldAtIso));
      const holdIds: string[] = [];
      for (const hold of sellerHolds) {
        await tx.insert(walletSellerHolds).values({
          id: hold.holdId,
          orderId: order.id,
          sellerAccountId: hold.sellerAccountId,
          escrowAccountId: hold.escrowAccountId,
          amount: hold.amount,
          currency: order.currency,
          status: "held",
          heldAt: now,
          releaseAt,
          holdLedgerBatchId: ids.ledgerBatchId,
          createdAt: now,
          updatedAt: now,
        });
        holdIds.push(hold.holdId);
      }

      await tx.insert(payments).values({
        id: ids.paymentId,
        orderId: order.id,
        amount: order.totalAmount,
        currency: order.currency,
        provider: "wallet",
        providerTransactionId: ids.ledgerBatchId,
        status: "completed",
        createdAt: now,
        updatedAt: now,
      });

      const [updated] = await tx
        .update(orders)
        .set({ status: "completed", updatedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
        .returning({ id: orders.id });
      if (!updated) throw new AppError("Order settlement raced", 409, "ORDER_STATE_CHANGED");

      const purchasedBuilds = [...(input.purchasedBuilds ?? [])];
      const buildByProduct = new Map(
        purchasedBuilds.map((entry) => [entry.productId, entry] as const),
      );
      const granted: string[] = [];
      for (const line of lines) {
        const entitlementId = `ent_${createHash("sha256")
          .update(`wspend:${order.id}:${line.productId}`)
          .digest("hex")
          .slice(0, 32)}`;
        await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, line.productId))
          .limit(1)
          .for("no key update");

        const [existingAccess] = await tx
          .select({ id: entitlements.id })
          .from(entitlements)
          .where(
            and(
              eq(entitlements.subjectType, "user"),
              eq(entitlements.subjectId, input.buyerId),
              eq(entitlements.resourceId, line.productId),
              eq(entitlements.permission, "product.download"),
              or(sql`${entitlements.expiresAt} is null`, sql`${entitlements.expiresAt} > ${now}`),
            ),
          )
          .limit(1);
        if (!existingAccess) {
          const purchased = buildByProduct.get(line.productId);
          await tx.insert(entitlements).values({
            id: entitlementId,
            subjectType: "user",
            subjectId: input.buyerId,
            permission: "product.download",
            resourceId: line.productId,
            metadata: purchased ? { buildId: purchased.buildId, version: purchased.version } : {},
            createdAt: now,
          });
          await tx.insert(resourceAcquisitionEvents).values({
            id: entitlementId,
            userId: input.buyerId,
            productId: line.productId,
            entitlementId,
            source: "direct",
            requestId: null,
            createdAt: now,
          });
          await tx
            .update(products)
            .set({ salesCount: sql`${products.salesCount} + 1` })
            .where(eq(products.id, line.productId));
          granted.push(entitlementId);
        }
      }

      await tx.insert(auditEvents).values({
        id: ids.auditId,
        actorId: input.buyerId,
        actorType: "user",
        action: "order.wallet_settled",
        targetId: order.id,
        targetType: "order",
        details: {
          paymentId: ids.paymentId,
          ledgerBatchId: ids.ledgerBatchId,
          totalAmount: order.totalAmount,
          currency: order.currency,
          platformFee: split.platformFee,
          sellerHoldCount: holdIds.length,
          entitlementCount: granted.length,
          purchasedBuilds,
        },
      });

      return {
        orderId: order.id,
        paymentId: ids.paymentId,
        ledgerBatchId: ids.ledgerBatchId,
        status: "completed" as const,
        totalAmount: order.totalAmount,
        currency,
        entries,
        alreadySettled: false,
        entitlementIds: granted,
        holdIds,
        purchasedBuilds,
      };
    });
  }

  /**
   * Staff full wallet refund: reverse spend ledger, cancel/clawback holds,
   * mark payment+order refunded, expire download entitlements granted by settle.
   * Live PSP refund adapters stay off.
   */
  async refund(input: { actorId: string; orderId: string }): Promise<WalletOrderRefundResult> {
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(input.orderId)) {
      throw new AppError("Order id is invalid", 400, "WALLET_ORDER_INVALID");
    }
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(input.actorId)) {
      throw new AppError("Actor id is invalid", 400, "WALLET_REFUND_INVALID");
    }
    const settleIds = walletSettleIds(input.orderId);
    const ids = walletRefundIds(input.orderId);

    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-refund:${input.orderId}`}))`,
      );

      const [order] = await tx
        .select({
          id: orders.id,
          buyerId: orders.buyerId,
          status: orders.status,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
          listAmount: orders.listAmount,
          discountAmount: orders.discountAmount,
          promoCode: orders.promoCode,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1)
        .for("update");
      if (!order) throw new NotFoundError("Order", input.orderId);

      const [payment] = await tx
        .select({
          id: payments.id,
          status: payments.status,
          amount: payments.amount,
          currency: payments.currency,
          provider: payments.provider,
          providerTransactionId: payments.providerTransactionId,
        })
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.id, settleIds.paymentId)))
        .limit(1)
        .for("update");
      if (payment?.provider !== "wallet") {
        throw new AppError("Order has no wallet payment to refund", 409, "WALLET_REFUND_STATE");
      }
      if (payment.status === "refunded" && order.status === "refunded") {
        const entries = (await tx
          .select()
          .from(ledgerEntries)
          .where(eq(ledgerEntries.batchId, ids.ledgerBatchId))
          .orderBy(asc(ledgerEntries.id))) as LedgerEntry[];
        return {
          orderId: order.id,
          paymentId: payment.id,
          ledgerBatchId: ids.ledgerBatchId,
          status: "refunded" as const,
          totalAmount: order.totalAmount,
          currency: order.currency as WalletCurrency,
          entries,
          alreadyRefunded: true,
          cancelledHoldIds: [],
          clawedBackHoldIds: [],
          expiredEntitlementIds: [],
        };
      }
      if (payment.status !== "completed" || order.status !== "completed") {
        throw new AppError("Order cannot accept wallet refund", 409, "WALLET_REFUND_STATE");
      }
      if (
        payment.amount !== order.totalAmount ||
        payment.currency !== order.currency ||
        payment.providerTransactionId !== settleIds.ledgerBatchId
      ) {
        throw new AppError("Wallet payment does not match order", 409, "WALLET_REFUND_STATE");
      }

      const holdRows = await tx
        .select()
        .from(walletSellerHolds)
        .where(eq(walletSellerHolds.orderId, order.id))
        .orderBy(asc(walletSellerHolds.id))
        .for("update");
      if (holdRows.some((row) => row.status === "cancelled")) {
        throw new AppError("Seller hold already cancelled", 409, "WALLET_HOLD_STATE");
      }

      const currency = order.currency as WalletCurrency;
      const holdTotal = holdRows.reduce((sum, row) => sum + row.amount, 0);
      const discount = order.discountAmount ?? 0;
      const listAmount = order.listAmount ?? order.totalAmount;
      if (
        (order.promoCode === null) !== (discount === 0) ||
        listAmount - discount !== order.totalAmount
      ) {
        throw new AppError("Wallet refund split does not balance", 400, "WALLET_REFUND_INVALID");
      }
      const platformFee = listAmount - holdTotal;
      if (!Number.isSafeInteger(platformFee) || platformFee < 0) {
        throw new AppError("Wallet refund split does not balance", 400, "WALLET_REFUND_INVALID");
      }

      for (const row of holdRows) {
        if (row.status === "released") {
          const available = await accountBalanceInTransaction(tx, row.sellerAccountId, currency);
          if (available < row.amount) {
            throw new AppError(
              "Seller available balance is insufficient for refund clawback",
              409,
              "WALLET_INSUFFICIENT_FUNDS",
            );
          }
        }
      }

      const buyerAccountId = walletAccountIdForUser(order.buyerId);
      const posting = buildWalletOrderRefundPosting({
        orderId: order.id,
        buyerAccountId,
        amount: order.totalAmount,
        currency,
        platformFee,
        buyerEntryId: ids.buyerEntryId,
        platformFeeEntryId: ids.platformFeeEntryId,
        holds: holdRows.map((row) => ({
          id: row.id,
          sellerAccountId: row.sellerAccountId,
          escrowAccountId: row.escrowAccountId,
          amount: row.amount,
          status: row.status as "held" | "released",
          entryId: ids.holdEntryId(row.id),
        })),
        ...(discount > 0 && order.promoCode
          ? {
              promoRestore: {
                amount: discount,
                entryId: ids.promoEntryId,
                code: order.promoCode,
              },
            }
          : {}),
      });
      const entries = await postLedgerBatchInTransaction(tx, ids.ledgerBatchId, posting);

      const now = new Date();
      const cancelledHoldIds: string[] = [];
      const clawedBackHoldIds: string[] = [];
      for (const row of holdRows) {
        if (row.status === "held") {
          const [updated] = await tx
            .update(walletSellerHolds)
            .set({ status: "cancelled", updatedAt: now })
            .where(and(eq(walletSellerHolds.id, row.id), eq(walletSellerHolds.status, "held")))
            .returning({ id: walletSellerHolds.id });
          if (!updated) throw new AppError("Hold cancel raced", 409, "WALLET_HOLD_STATE");
          cancelledHoldIds.push(row.id);
        } else {
          const [updated] = await tx
            .update(walletSellerHolds)
            .set({ status: "cancelled", updatedAt: now })
            .where(and(eq(walletSellerHolds.id, row.id), eq(walletSellerHolds.status, "released")))
            .returning({ id: walletSellerHolds.id });
          if (!updated) throw new AppError("Hold clawback raced", 409, "WALLET_HOLD_STATE");
          clawedBackHoldIds.push(row.id);
        }
      }

      const [paymentUpdated] = await tx
        .update(payments)
        .set({ status: "refunded", updatedAt: now })
        .where(and(eq(payments.id, payment.id), eq(payments.status, "completed")))
        .returning({ id: payments.id });
      if (!paymentUpdated) throw new AppError("Payment refund raced", 409, "WALLET_REFUND_STATE");

      const [orderUpdated] = await tx
        .update(orders)
        .set({ status: "refunded", updatedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "completed")))
        .returning({ id: orders.id });
      if (!orderUpdated) throw new AppError("Order refund raced", 409, "WALLET_REFUND_STATE");

      const lines = await tx
        .select({ productId: orderItems.productId })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      const expiredEntitlementIds: string[] = [];
      for (const line of lines) {
        const entitlementId = `ent_${createHash("sha256")
          .update(`wspend:${order.id}:${line.productId}`)
          .digest("hex")
          .slice(0, 32)}`;
        const [expired] = await tx
          .update(entitlements)
          .set({ expiresAt: now })
          .where(
            and(
              eq(entitlements.id, entitlementId),
              eq(entitlements.subjectType, "user"),
              eq(entitlements.subjectId, order.buyerId),
              eq(entitlements.resourceId, line.productId),
              eq(entitlements.permission, "product.download"),
              or(sql`${entitlements.expiresAt} is null`, sql`${entitlements.expiresAt} > ${now}`),
            ),
          )
          .returning({ id: entitlements.id });
        if (expired) expiredEntitlementIds.push(expired.id);
      }

      await tx.insert(auditEvents).values({
        id: ids.auditId,
        actorId: input.actorId,
        actorType: "admin",
        action: "order.wallet_refunded",
        targetId: order.id,
        targetType: "order",
        details: {
          paymentId: payment.id,
          ledgerBatchId: ids.ledgerBatchId,
          totalAmount: order.totalAmount,
          currency: order.currency,
          platformFee,
          cancelledHoldCount: cancelledHoldIds.length,
          clawedBackHoldCount: clawedBackHoldIds.length,
          expiredEntitlementCount: expiredEntitlementIds.length,
        },
      });

      return {
        orderId: order.id,
        paymentId: payment.id,
        ledgerBatchId: ids.ledgerBatchId,
        status: "refunded" as const,
        totalAmount: order.totalAmount,
        currency,
        entries,
        alreadyRefunded: false,
        cancelledHoldIds,
        clawedBackHoldIds,
        expiredEntitlementIds,
      };
    });
  }
}

export const walletOrderSettlementRepository = new WalletOrderSettlementRepository();
