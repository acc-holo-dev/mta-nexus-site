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

export const walletProviderIdSchema = providerId;
