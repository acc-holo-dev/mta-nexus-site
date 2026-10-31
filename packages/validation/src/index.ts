import {
  PRODUCT_TYPES,
  SUPPORT_CASE_CATEGORIES,
  SUPPORT_CASE_STATUSES,
  normalizeMtaAddress,
  isValidMtaAddress,
} from "@nexus/domain";
import { z } from "zod";
export * from "./commercial-plans";
export * from "./resource-release-control";
export * from "./resource-release-watches";
import { mtaVersionSchema } from "./mta-version";
import { resourceCompatibilitySchema } from "./resource-management";
export * from "./mta-version";
export * from "./resource-management";
export * from "./resource-commerce";
export * from "./license-control";
export * from "./library-collections";

// Shared by input validation and rendering of legacy public links.
export function safeExternalWebUrl(value: unknown): string | undefined {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject URL parser normalization of literal control characters.
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value))
    return undefined;
  if (!/^https?:\/\//i.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password || value.includes("\\")) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export const externalWebUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (value) => safeExternalWebUrl(value) !== undefined,
    "Use an HTTP or HTTPS URL without credentials or whitespace",
  );

// --- Auth & User Schemas ---
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username cannot exceed 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain alphanumeric characters, underscores, and hyphens",
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
  displayName: z.string().min(2).max(50).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
  })
  .superRefine((value, context) => {
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must be different from the current password",
      });
    }
  });

export const requestRecoveryEmailVerificationSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128),
  })
  .strict();

export const confirmRecoveryEmailVerificationSchema = z
  .object({
    challengeId: z
      .string()
      .min(1)
      .max(100)
      .regex(/^ach_[A-Za-z0-9_-]+$/, "Invalid confirmation identifier"),
    token: z
      .string()
      .length(43)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid confirmation token"),
  })
  .strict();

export const requestPasswordResetSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(320)
      .transform((value) => value.toLowerCase()),
  })
  .strict();

export const confirmPasswordResetSchema = z
  .object({
    challengeId: z
      .string()
      .min(1)
      .max(100)
      .regex(/^ach_[A-Za-z0-9_-]+$/, "Invalid reset identifier"),
    token: z
      .string()
      .length(43)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid reset token"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
  })
  .strict();

export const notificationPreferencesSchema = z
  .object({
    followsEnabled: z.boolean().optional(),
    contentEnabled: z.boolean().optional(),
    serverEnabled: z.boolean().optional(),
    commerceEnabled: z.boolean().optional(),
    systemEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one notification preference is required",
  });

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

// --- Organization Schemas ---
export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(64),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  websiteUrl: externalWebUrlSchema.optional().or(z.literal("")),
});

// --- Server Schemas ---
export const createServerSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  websiteUrl: externalWebUrlSchema.max(500).optional().or(z.literal("")),
  discordUrl: externalWebUrlSchema.max(500).optional().or(z.literal("")),
  rulesUrl: externalWebUrlSchema.max(500).optional().or(z.literal("")),
  mediaUrls: z.array(externalWebUrlSchema.max(500)).max(8).default([]),
  language: z.string().trim().max(64).optional(),
  region: z.string().trim().max(64).optional(),
  gameplayTags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
  // Canonicalize before uniqueness checks and match the public MTA directory.
  // The explicit game port is a separate field; do not accept host:port here.
  ipAddress: z
    .string()
    .max(255)
    .transform(normalizeMtaAddress)
    .refine(isValidMtaAddress, "Enter a valid MTA host or IP without a port"),
  port: z.coerce.number().int().min(1).max(65535).default(22003),
  httpPort: z.coerce.number().int().min(1).max(65535).default(22005),
  maxPlayers: z.coerce.number().int().min(1).max(4096).default(128),
  gameMode: z.string().max(64).optional(),
  mapName: z.string().max(64).optional(),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  organizationId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,128}$/)
    .optional(),
});

// Zod applies inner defaults even through optional()/partial(). PATCH must
// retain only supplied fields, or a description edit could reset private
// visibility, custom ports, media and capacity to registration defaults.
export const updateServerSchema = createServerSchema
  .extend({
    mediaUrls: createServerSchema.shape.mediaUrls.unwrap(),
    gameplayTags: createServerSchema.shape.gameplayTags.unwrap(),
    port: createServerSchema.shape.port.unwrap(),
    httpPort: createServerSchema.shape.httpPort.unwrap(),
    maxPlayers: createServerSchema.shape.maxPlayers.unwrap(),
    visibility: createServerSchema.shape.visibility.unwrap(),
  })
  .partial();

// --- Product Schemas ---
export const createProductSchema = z.object({
  title: z.string().min(3).max(120),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  shortDescription: z.string().max(250).optional(),
  description: z.string().min(10).max(10000),
  type: z.enum(PRODUCT_TYPES),
  price: z.coerce.number().int().min(0, "Price must be non-negative in cents"),
  currency: z.string().length(3).default("USD"),
  licenseModel: z.enum([
    "single_server",
    "multiple_servers",
    "organization",
    "subscription",
    "unlimited",
  ]),
  tags: z.array(z.string().min(1).max(30)).default([]),
  organizationId: z.string().optional(),
  compatibility: z
    .object({
      mtaMinVersion: mtaVersionSchema.optional(),
      dependencies: z
        .array(
          z
            .string()
            .min(3)
            .max(120)
            .regex(/^[a-z0-9][a-z0-9._-]*$/, "Use a resource slug"),
        )
        .max(25)
        .default([])
        .superRefine((dependencies, context) => {
          const seen = new Set<string>();
          dependencies.forEach((dependency, index) => {
            if (seen.has(dependency)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Dependencies must be unique",
                path: [index],
              });
            }
            seen.add(dependency);
          });
        }),
    })
    .default({ dependencies: [] }),
});

export const updateProductSchema = createProductSchema.partial();

// --- Build Release Schemas ---
export const createBuildSchema = z.object({
  productId: z.string().min(1),
  version: z
    .string()
    .regex(/^v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?$/, "Semantic version expected"),
  releaseNotes: z.string().max(5000).optional(),
  storageKey: z.string().min(1),
  sha256Hash: z.string().length(64, "SHA-256 hash must be 64 characters"),
  fileSizeBytes: z.number().int().positive(),
  mtaVersionTarget: mtaVersionSchema.optional(),
});

// --- Resource acquisition ---
export const claimResourceSchema = z
  .object({
    productId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u),
  })
  .strict();

// --- Checkout & Orders ---
export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
      }),
    )
    .min(1, "At least one product is required for checkout"),
  paymentProvider: z.enum(["mock", "stripe", "crypto"]).default("mock"),
  serverId: z.string().optional(), // For auto-binding license to a specific server
});

// --- Content Schemas ---
export const createContentSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  body: z.string().min(10),
  excerpt: z.string().max(350).optional(),
  type: z.enum([
    "article",
    "post",
    "news",
    "devlog",
    "update",
    "announcement",
    "question",
    "review",
  ]),
  tags: z.array(z.string().min(1).max(30)).default([]),
  coverImageUrl: externalWebUrlSchema.optional().or(z.literal("")),
  serverId: z.string().optional(),
  productId: z.string().optional(),
  organizationId: z.string().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const addCommentSchema = z.object({
  contentId: z.string().optional(),
  productId: z.string().optional(),
  parentId: z.string().optional(),
  text: z.string().min(1).max(2000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export const createContentCommentSchema = z
  .object({
    parentId: z.string().min(1).optional(),
    text: z.string().trim().min(1).max(2000),
  })
  .strict();

// --- Moderation & Reports ---
export const createReportSchema = z.object({
  targetType: z.enum(["product", "server", "content", "comment", "user"]),
  targetId: z.string().min(1).max(128),
  type: z.enum([
    "scam",
    "copyright",
    "malware",
    "abuse",
    "fake_product",
    "fake_server",
    "spam",
    "other",
  ]),
  reason: z.string().min(10).max(1000),
  evidenceUrls: z.array(externalWebUrlSchema).max(5).default([]),
});

// --- Unified Support ---
export const supportStaffQueueFiltersSchema = z
  .object({
    status: z.enum(SUPPORT_CASE_STATUSES).optional(),
    category: z.enum(SUPPORT_CASE_CATEGORIES).optional(),
  })
  .strict();

export const createSupportCaseSchema = z
  .object({
    category: z.enum(SUPPORT_CASE_CATEGORIES),
    subject: z.string().trim().min(5).max(120),
    message: z.string().trim().min(10).max(4_000),
  })
  .strict();

export const createSupportMessageSchema = z
  .object({
    message: z.string().trim().min(1).max(4_000),
    // The state seen by the author when composing this reply.
    expectedStatus: z.enum(SUPPORT_CASE_STATUSES),
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();

export const updateSupportCaseStatusSchema = z
  .object({
    status: z.enum(SUPPORT_CASE_STATUSES),
    // Require the client-observed status as an optimistic concurrency precondition.
    expectedStatus: z.enum(SUPPORT_CASE_STATUSES),
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();

// --- Search & Discovery ---
export const searchFilterSchema = z.object({
  query: z.string().optional().default(""),
  category: z.string().optional(),
  type: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z
    .enum(["relevance", "popular", "newest", "price_asc", "price_desc", "rating"])
    .default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Author editing cannot change ownership, slug, pricing or publication state.
export const editProductDetailsSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    shortDescription: z.string().trim().max(250),
    description: z.string().trim().min(10).max(10_000),
    tags: z.array(z.string().trim().min(1).max(30)).max(20),
  })
  .strict();
export const resourceCopyMetadataSchema = editProductDetailsSchema
  .omit({ title: true })
  .extend({
    type: z.enum(PRODUCT_TYPES),
    compatibility: resourceCompatibilitySchema.shape.compatibility,
  })
  .strict();
export const resourceCopyCommandSchema = z
  .object({
    requestId: z.string().uuid(),
    reviewDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    title: editProductDetailsSchema.shape.title,
    slug: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  })
  .strict();
export * from "./resource-reviews";
export * from "./server-reviews";
export * from "./resource-build-workspace";
export * from "./order-cases";
export * from "./resource-media";
export * from "./plan-reviews";
export * from "./subscriptions";

export * from "./library-selection-batches";
