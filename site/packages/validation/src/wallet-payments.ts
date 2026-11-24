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

const organizationId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{3,128}$/u, "Organization id must be 3–128 URL-safe characters");

export const walletTopUpCreateSchema = z
  .object({
    amount: z.number().int().positive().max(2_147_483_647),
    currency,
    providerId,
    idempotencyKey,
    returnPath,
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletTopUpStubCreditSchema = z
  .object({
    outcome: z.enum(["succeeded", "failed"]),
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletTopUpCancelSchema = z
  .object({
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletTopUpQuerySchema = z
  .object({
    currency,
    limit: z.coerce.number().int().min(1).max(100).optional(),
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletOrderRefundSchema = z
  .object({
    orderId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/u, "Order id must be 1–128 URL-safe characters"),
  })
  .strict();

export const walletBalanceQuerySchema = z
  .object({
    currency,
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletActivityQuerySchema = z
  .object({
    currency,
    limit: z.coerce.number().int().min(1).max(100).optional(),
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletHeldQuerySchema = z
  .object({
    currency,
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletHoldReleaseSchema = z
  .object({
    nowIso: z.string().datetime().optional(),
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletHoldReleaseBatchSchema = z
  .object({
    nowIso: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export const walletStaffGrantSchema = z
  .object({
    username: z
      .string()
      .min(3)
      .max(32)
      .regex(
        /^[a-zA-Z0-9_-]+$/u,
        "Username can only contain alphanumeric characters, underscores, and hyphens",
      ),
    amount: z.number().int().positive().max(100_000_000),
    currency,
    reason: z
      .string()
      .regex(/^[\p{L}\p{N}\p{P}\p{Zs}]{8,280}$/u, "Reason must be 8–280 characters"),
    idempotencyKey,
  })
  .strict();

export const walletIntentExpireBatchSchema = z
  .object({
    nowIso: z.string().datetime().optional(),
    maxAgeMs: z
      .number()
      .int()
      .min(60_000)
      .max(90 * 24 * 60 * 60 * 1000)
      .optional(),
    limit: z.number().int().min(1).max(50).optional(),
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

const buildId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/u, "Build id must be 1–128 URL-safe characters");

export const walletCheckoutSchema = z
  .object({
    productIds: z
      .array(productId)
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, "Product ids must be unique"),
    /** Optional published build bind for single-product checkout evidence. */
    buildId: buildId.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.buildId && value.productIds.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "buildId requires exactly one productId",
        path: ["buildId"],
      });
    }
  });

export const walletWithdrawalCreateSchema = z
  .object({
    amount: z.number().int().positive().max(2_147_483_647),
    currency,
    providerId,
    idempotencyKey,
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletWithdrawalQuerySchema = z
  .object({
    currency,
    limit: z.coerce.number().int().min(1).max(100).optional(),
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletWithdrawalCancelSchema = z
  .object({
    organizationId: organizationId.optional(),
  })
  .strict();

export const walletWithdrawalStubSettleSchema = z
  .object({
    outcome: z.enum(["succeeded", "failed"]),
    organizationId: organizationId.optional(),
  })
  .strict();
