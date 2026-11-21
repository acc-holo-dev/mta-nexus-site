import { PAYMENT_PROVIDER_IDS, WALLET_CURRENCIES } from "@nexus/domain";
import { z } from "zod";

const providerId = z.enum(PAYMENT_PROVIDER_IDS);
const currency = z.enum(WALLET_CURRENCIES);
const idempotencyKey = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,128}$/u, "Idempotency key must be 8–128 URL-safe characters");
const returnPath = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"),
    "Return path must be a same-origin absolute path",
  );

export const walletTopUpCreateSchema = z
  .object({
    amount: z.number().int().positive().max(2_147_483_647),
    currency,
    providerId,
    idempotencyKey,
    returnPath,
  })
  .strict();

export const walletBalanceQuerySchema = z
  .object({
    currency,
  })
  .strict();

export const walletActivityQuerySchema = z
  .object({
    currency,
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const walletProviderIdSchema = providerId;

export const walletPayOrderSchema = z
  .object({
    orderId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/u, "Order id must be 1–128 URL-safe characters"),
  })
  .strict();

const productId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,160}$/u, "Product id must be 1–160 URL-safe characters");

export const walletCheckoutSchema = z
  .object({
    productIds: z
      .array(productId)
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, "Product ids must be unique"),
  })
  .strict();
