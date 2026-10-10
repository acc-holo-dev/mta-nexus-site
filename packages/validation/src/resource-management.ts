import { RESOURCE_VARIANT_LIMIT } from "@nexus/domain";
import { z } from "zod";
import { mtaVersionSchema } from "./mta-version";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
const reason = z.string().trim().min(5).max(1000);
export const resourceVariantCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      expectedGroupId: id.nullable(),
      expectedRevision: z.number().int().min(0).max(2_147_483_646),
      title: z.string().trim().min(3).max(80),
      variants: z
        .array(z.object({ productId: id, label: z.string().trim().min(1).max(60) }).strict())
        .min(1)
        .max(RESOURCE_VARIANT_LIMIT)
        .refine(
          (rows) => new Set(rows.map((row) => row.productId)).size === rows.length,
          "Duplicate resource",
        )
        .refine(
          (rows) => new Set(rows.map((row) => row.label.toLowerCase())).size === rows.length,
          "Duplicate label",
        ),
      reason,
    })
    .strict()
    .refine((value) =>
      value.expectedGroupId === null ? value.expectedRevision === 0 : value.expectedRevision > 0,
    ),
  z
    .object({
      action: z.literal("remove"),
      expectedGroupId: id,
      expectedRevision: z.number().int().min(1).max(2_147_483_647),
      reason,
    })
    .strict(),
]);
export const resourceCompatibilitySchema = z
  .object({
    expectedUpdatedAt: z
      .string()
      .datetime({ precision: 3, offset: false })
      .refine(
        (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
      ),
    compatibility: z
      .object({
        mtaMinVersion: mtaVersionSchema.optional(),
        dependencies: z
          .array(
            z
              .string()
              .trim()
              .toLowerCase()
              .min(3)
              .max(120)
              .regex(/^[a-z0-9][a-z0-9._-]*$/u),
          )
          .max(25)
          .refine((values) => new Set(values).size === values.length, "Duplicate dependency"),
      })
      .strict(),
  })
  .strict();
