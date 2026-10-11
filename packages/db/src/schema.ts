import {
  PRODUCT_TYPES,
  SUPPORT_CASE_CATEGORIES,
  SUPPORT_CASE_STATUSES,
  SUPPORT_RELATED_TYPES,
  type ProductType,
  type StorageObjectIdentity,
  type StorageMaintenanceState,
  type BuildPackageEvidence,
  type BuildReviewNotificationData,
  type LicenseTermNotificationData,
  type ResourceDeliveryStatus, type ResourceDeliveryError,
  type ResourceReleaseNoticeData,
  type SupportCaseCategory,
  type SupportCaseStatus,
  type SupportMessageAuthorRole,
  type SupportRelatedType,
  type ResourceCartAcquisition,
  type ResourceCartReceiptItem,
  type CommercialPlanTerms,
  type CommercialPlanStatus,
  type OrderCaseKind, type OrderCaseReviewStatus, type OrderCaseEvidence,
} from "@nexus/domain";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  bigint, bigserial,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  unique,
  primaryKey,
  foreignKey,
  uuid,
  check,
} from "drizzle-orm/pg-core";

// 1. Users
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    role: text("role").notNull().default("user"), // user, developer, server_owner, moderator, admin
    isVerified: boolean("is_verified").notNull().default(false),
    emailVerified: boolean("email_verified").notNull().default(false),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    activeContextId: text("active_context_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_username_idx").on(table.username),
    index("users_role_idx").on(table.role),
  ]
);

// 2. Sessions
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
  ]
);

// 3. Organizations
export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    logoUrl: text("logo_url"),
    websiteUrl: text("website_url"),
    isVerified: boolean("is_verified").notNull().default(false),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("organizations_slug_idx").on(table.slug)]
);

// 4. Organization Members
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner, admin, developer, member
    permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("org_user_idx").on(table.organizationId, table.userId),
    index("org_members_user_idx").on(table.userId),
  ]
);

// 5. Developer Profiles
export const developerProfiles = pgTable("developer_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  specialties: jsonb("specialties").$type<string[]>().default([]).notNull(),
  githubUrl: text("github_url"),
  discordTag: text("discord_tag"),
  reputationScore: integer("reputation_score").notNull().default(100),
  completedDealsCount: integer("completed_deals_count").notNull().default(0),
  verifiedDeveloper: boolean("verified_developer").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 6. Servers
export const servers = pgTable(
  "servers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    websiteUrl: text("website_url"),
    discordUrl: text("discord_url"),
    rulesUrl: text("rules_url"),
    mediaUrls: jsonb("media_urls").$type<string[]>().default([]).notNull(),
    language: text("language"),
    region: text("region"),
    gameplayTags: jsonb("gameplay_tags").$type<string[]>().default([]).notNull(),
    ipAddress: text("ip_address").notNull(),
    port: integer("port").notNull().default(22003),
    httpPort: integer("http_port").default(22005),
    gameMode: text("game_mode"),
    mapName: text("map_name"),
    maxPlayers: integer("max_players"),
    currentPlayers: integer("current_players"),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"), // active, inactive, maintenance, suspended
    visibility: text("visibility").notNull().default("public"), // public, unlisted, private
    isVerified: boolean("is_verified").notNull().default(false),
    // Only network endpoint edits increment this counter; editorial changes do not.
    endpointRevision: integer("endpoint_revision").notNull().default(0),
    bannerUrl: text("banner_url"),
    logoUrl: text("logo_url"),
    lastObservedAt: timestamp("last_observed_at", { withTimezone: true }),
    observationSource: text("observation_source"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("servers_slug_idx").on(table.slug),
    index("servers_status_idx").on(table.status),
    index("servers_owner_idx").on(table.ownerId),
    uniqueIndex("servers_endpoint_idx").on(table.ipAddress, table.port),
    index("servers_last_observed_idx").on(table.lastObservedAt),
    check("servers_endpoint_revision_nonnegative", sql`${table.endpointRevision} >= 0`),
  ]
);

// 7. Immutable observations fetched by NEXUS from public MTA sources.
export const serverObservations = pgTable("server_observations", {
  id: text("id").primaryKey(),
  serverId: text("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  sourceSequence: text("source_sequence"),
  name: text("name"),
  gameMode: text("game_mode"),
  mapName: text("map_name"),
  mtaVersion: text("mta_version"),
  currentPlayers: integer("current_players"),
  maxPlayers: integer("max_players"),
  passworded: boolean("passworded"),
  responding: boolean("responding"),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("server_observations_server_time_idx").on(table.serverId, table.observedAt),
  uniqueIndex("server_observations_source_sequence_idx").on(table.source, table.sourceSequence, table.serverId),
]);

// 8. Products
export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull(),
    shortDescription: text("short_description"),
    type: text("type").$type<ProductType>().notNull(),
    status: text("status").notNull().default("draft"), // draft, pending_review, published, suspended, archived
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    metadataReviewRequired: boolean("metadata_review_required").notNull().default(false),
    price: integer("price").notNull().default(0), // in cents
    currency: text("currency").notNull().default("USD"),
    licenseModel: text("license_model").notNull().default("single_server"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    currentVersion: text("current_version").notNull().default("1.0.0"),
    ratingAverage: integer("rating_average").notNull().default(0), // multiplied by 10 (e.g. 48 = 4.8)
    ratingCount: integer("rating_count").notNull().default(0),
    salesCount: integer("sales_count").notNull().default(0),
    isFeatured: boolean("is_featured").notNull().default(false),
    thumbnailUrl: text("thumbnail_url"),
    screenshots: jsonb("screenshots").$type<string[]>().default([]).notNull(),
    compatibility: jsonb("compatibility")
      .$type<{ mtaMinVersion?: string; dependencies?: string[] }>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("products_slug_idx").on(table.slug),
    check("products_type_check", sql`${table.type} IN (${sql.raw(PRODUCT_TYPES.map((type) => `'${type}'`).join(", "))})`),
    index("products_type_idx").on(table.type),
    index("products_status_idx").on(table.status),
    index("products_moderation_status_updated_id_idx").on(table.status, table.updatedAt.desc(), table.id.desc()),
    index("products_moderation_updated_id_idx").on(table.updatedAt.desc(), table.id.desc()),
    index("products_author_idx").on(table.authorId),
    index("products_sales_org_id_idx").on(table.organizationId, table.id).where(sql`${table.organizationId} IS NOT NULL`),
    index("products_managed_updated_id_idx").on(table.updatedAt.desc(), table.id.desc()).where(sql`${table.price} = 0`),
    check("products_metadata_review_state_check", sql`NOT ${table.metadataReviewRequired} OR ${table.status} <> 'published'`),
    index("products_public_author_created_id_idx")
      .on(table.authorId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.status} = 'published' AND ${table.price} = 0`),
    index("products_public_org_created_id_idx")
      .on(table.organizationId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.status} = 'published' AND ${table.price} = 0`),
    index("products_featured_idx").on(table.isFeatured),
  ]
);

// Only canonical PNG images are stored here; the first ordered image is the cover.
export const resourceMedia = pgTable("resource_media", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull().unique(),
  sha256Hash: text("sha256_hash").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  width: integer("width").notNull(), height: integer("height").notNull(),
  scanner: text("scanner").notNull(), scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
  caption: text("caption").notNull().default(""),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  // Migration 0060 makes this constraint deferred to permit atomic order swaps.
  unique("resource_media_product_position_unique").on(table.productId, table.position),
  unique("resource_media_product_hash_unique").on(table.productId, table.sha256Hash),
  check("resource_media_identity_check", sql`${table.id} ~ '^rmi_[A-Za-z0-9_-]{1,100}$' AND ${table.storageKey} ~ '^assets/[A-Za-z0-9_-]{1,128}/ast_[A-Za-z0-9_-]+\\.png$' AND ${table.sha256Hash} ~ '^[a-f0-9]{64}$' AND ${table.fileSizeBytes} BETWEEN 1 AND 4194304 AND ${table.width} BETWEEN 1 AND 1920 AND ${table.height} BETWEEN 1 AND 1920 AND length(btrim(${table.scanner})) BETWEEN 1 AND 100 AND ${table.scanner} <> 'disabled'`),
  check("resource_media_caption_check", sql`length(${table.caption}) <= 160`),
  check("resource_media_position_check", sql`${table.position} BETWEEN 0 AND 7`),
]);

// Variant links carry no access grants. Each resource retains its own releases.
export const productVariantGroups = pgTable("product_variant_groups", {
  id: text("id").primaryKey(),
  anchorProductId: text("anchor_product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("product_variant_anchor_idx").on(table.anchorProductId),
  check("product_variant_title_check", sql`length(btrim(${table.title})) between 3 and 80`),
  check("product_variant_revision_check", sql`${table.revision} > 0`),
]);
export const productVariantMembers = pgTable("product_variant_members", {
  productId: text("product_id").primaryKey().references(() => products.id, { onDelete: "cascade" }),
  groupId: text("group_id").notNull().references(() => productVariantGroups.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  position: integer("position").notNull(),
}, table => [
  uniqueIndex("product_variant_position_idx").on(table.groupId, table.position),
  uniqueIndex("product_variant_label_idx").on(table.groupId, sql`lower(btrim(${table.label}))`),
  check("product_variant_label_check", sql`length(btrim(${table.label})) between 1 and 60`),
  check("product_variant_position_check", sql`${table.position} between 0 and 11`),
]);

// 9. Builds
export const builds = pgTable("builds", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(1),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  releaseNotes: text("release_notes"),
  status: text("status").notNull().default("draft"), // draft, testing, pending_review, published, rejected, deprecated, quarantined, retired
  storageKey: text("storage_key").notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  fileName: text("file_name").notNull().default("resource.zip"),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  scanStatus: text("scan_status").notNull().default("not_scanned"),
  scanner: text("scanner"),
  scannedAt: timestamp("scanned_at", { withTimezone: true }),
  mtaVersionTarget: text("mta_version_target"),
  isSigned: boolean("is_signed").notNull().default(false),
  quarantinePreviousStatus: text("quarantine_previous_status"),
  quarantineReason: text("quarantine_reason"),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
  quarantinedBy: text("quarantined_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  packageEvidence: jsonb("package_evidence").$type<BuildPackageEvidence>(),
}, (table) => [
  check("builds_package_evidence_check", sql`
  ${table.packageEvidence} IS NULL OR COALESCE((
    jsonb_typeof(${table.packageEvidence}) = 'object' AND
    octet_length(${table.packageEvidence}::text) <= 1048576 AND
    ${table.packageEvidence}->>'schemaVersion' = '1' AND
    ${table.packageEvidence}->>'inspector' = 'nexus-package-v1' AND
    ${table.packageEvidence}->>'format' IN ('zip', 'rar', '7z', 'lua') AND
    ${table.packageEvidence}->>'sha256Hash' = ${table.sha256Hash} AND ${table.sha256Hash} ~ '^[a-f0-9]{64}$' AND
    ${table.packageEvidence}->>'fileSizeBytes' = ${table.fileSizeBytes}::text AND ${table.fileSizeBytes} > 0 AND
    jsonb_typeof(${table.packageEvidence}->'inspectedAt') = 'string' AND
    length(${table.packageEvidence}->>'inspectedAt') BETWEEN 20 AND 40 AND
    ((${table.packageEvidence}->>'format' = 'zip' AND ${table.packageEvidence}->>'status' = 'checked' AND
      jsonb_typeof(${table.packageEvidence}->'archive') = 'object' AND
      CASE WHEN jsonb_typeof(${table.packageEvidence}->'files') = 'array' THEN
        jsonb_array_length(${table.packageEvidence}->'files') BETWEEN 0 AND 1000 AND
        ${table.packageEvidence}->'archive'->>'files' = jsonb_array_length(${table.packageEvidence}->'files')::text
      ELSE false END AND
      ${table.packageEvidence}->>'manifestStatus' IN ('single', 'missing', 'multiple') AND
      ((${table.packageEvidence}->>'manifestStatus' = 'single' AND jsonb_typeof(${table.packageEvidence}->'manifest') = 'object') OR
       (${table.packageEvidence}->>'manifestStatus' IN ('missing', 'multiple') AND ${table.packageEvidence}->'manifest' = 'null'::jsonb))) OR
     (${table.packageEvidence}->>'format' IN ('rar', '7z', 'lua') AND ${table.packageEvidence}->>'status' = 'not_inspected' AND
      ${table.packageEvidence}->>'manifestStatus' = 'not_inspected' AND ${table.packageEvidence}->'archive' = 'null'::jsonb AND ${table.packageEvidence}->'manifest' = 'null'::jsonb AND ${table.packageEvidence}->'files' = 'null'::jsonb))
  ), false)`),
  uniqueIndex("builds_product_version_idx").on(table.productId, table.version),
  check("builds_revision_check", sql`${table.revision} > 0`),
  index("builds_storage_key_idx").on(table.storageKey),
  index("builds_product_status_idx").on(table.productId, table.status),
  index("builds_status_created_id_idx").on(table.status, table.createdAt, table.id),
  check(
    "builds_clean_scan_provenance_check",
    sql`${table.scanStatus} <> 'clean' OR (
      ${table.scanner} IS NOT NULL
      AND btrim(${table.scanner}) <> ''
      AND ${table.scannedAt} IS NOT NULL
    )`,
  ),
  check(
    "builds_published_safe_check",
    sql`${table.status} <> 'published' OR (
      ${table.scanStatus} = 'clean'
      AND ${table.scanner} IS NOT NULL
      AND btrim(${table.scanner}) <> ''
      AND ${table.scannedAt} IS NOT NULL
    )`,
  ),
  check(
    "builds_quarantine_metadata_check",
    sql`${table.status} <> 'quarantined' OR (
      ${table.quarantinePreviousStatus} IN ('published', 'pending_review')
      AND ${table.quarantineReason} IS NOT NULL
      AND btrim(${table.quarantineReason}) <> ''
      AND ${table.quarantinedAt} IS NOT NULL
    )`,
  ),
]);

// 10. Assets
export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  status: text("status").notNull().default("ready"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("assets_storage_key_idx").on(table.storageKey)]);

// 11. Licenses
export const licenses = pgTable(
  "licenses",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    serverId: text("server_id").references(() => servers.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    status: text("status").notNull().default("active"), // active, expired, revoked, suspended
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    entitlements: jsonb("entitlements").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("licenses_key_idx").on(table.key),
    index("licenses_user_idx").on(table.userId),
    index("licenses_product_idx").on(table.productId),
    index("licenses_finite_term_due_idx").on(table.expiresAt, table.id).where(sql`${table.expiresAt} IS NOT NULL AND ${table.status} IN ('active','suspended','expired')`),
    index("licenses_user_active_library_idx")
      .on(table.userId, table.productId, table.expiresAt, table.createdAt)
      .where(sql`${table.status} = 'active'`),
  ]
);

// Durable identity snapshots intentionally survive server/organization deletion.
// Deletion must invalidate a binding, never make the license bindable again.
export const licenseRuntimeBindings = pgTable("license_runtime_bindings", {
  licenseId: text("license_id").primaryKey().references(() => licenses.id, { onDelete: "cascade" }),
  serverId: text("server_id").notNull(),
  serverOwnerId: text("server_owner_id"),
  organizationId: text("organization_id"),
  endpointRevision: integer("endpoint_revision").notNull(),
  tokenDigest: text("token_digest"),
  tokenIssuedAt: timestamp("token_issued_at", { withTimezone: true }),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("license_runtime_token_digest_idx").on(table.tokenDigest),
  index("license_runtime_server_idx").on(table.serverId),
  check("license_runtime_revision_check", sql`${table.endpointRevision} >= 0`),
  check("license_runtime_digest_check", sql`${table.tokenDigest} IS NULL OR ${table.tokenDigest} ~ '^[a-f0-9]{64}$'`),
  check("license_runtime_token_check", sql`(
    ${table.tokenDigest} IS NULL AND ${table.tokenIssuedAt} IS NULL AND ${table.tokenExpiresAt} IS NULL
  ) OR (
    ${table.tokenDigest} IS NOT NULL AND ${table.tokenIssuedAt} IS NOT NULL AND ${table.tokenExpiresAt} IS NOT NULL
    AND ${table.tokenExpiresAt} > ${table.tokenIssuedAt}
    AND ${table.tokenExpiresAt} <= ${table.tokenIssuedAt} + interval '720 hours'
  )`),
]);

// No historical events are invented; each processed finite term is recorded once.
export const licenseTermEvents = pgTable("license_term_events", {
  licenseId: text("license_id").notNull().references(() => licenses.id, { onDelete: "cascade" }),
  event: text("event").$type<"expiring" | "expired">().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  notified: boolean("notified").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.licenseId, table.event, table.expiresAt] }),
  check("license_term_event_check", sql`${table.event} IN ('expiring', 'expired')`),
]);

// 12. Entitlements
export const entitlements = pgTable("entitlements", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type").notNull(), // user, server, organization
  subjectId: text("subject_id").notNull(),
  permission: text("permission").notNull(),
  resourceId: text("resource_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("entitlements_user_download_library_idx")
    .on(table.subjectId, table.resourceId, table.expiresAt, table.createdAt)
    .where(sql`${table.subjectType} = 'user' AND ${table.permission} = 'product.download'`),
]);

// 13. Orders
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  buyerId: text("buyer_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("pending"), // pending, processing, completed, cancelled, refunded
  totalAmount: integer("total_amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Account-scoped acquisition basket. This contains no payments or balances.
export const resourceCartItems = pgTable(
  "resource_cart_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.productId] })],
);

export const resourceCartAcquisitions = pgTable(
  "resource_cart_acquisitions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    productIds: jsonb("product_ids").$type<string[]>().notNull(),
    result: jsonb("result").$type<ResourceCartAcquisition>().notNull(),
    reviewDigest: text("review_digest"),
    reviewSnapshot: jsonb("review_snapshot").$type<ResourceCartReceiptItem[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.requestId] }),
    index("resource_cart_receipt_user_time_idx").on(table.userId, table.createdAt.desc(), table.requestId.desc()),
    check("resource_cart_review_digest_check", sql`(${table.reviewDigest} IS NULL AND ${table.reviewSnapshot} IS NULL) OR
      (${table.reviewDigest} IS NOT NULL AND ${table.reviewDigest} ~ '^[a-f0-9]{64}$' AND ${table.reviewSnapshot} IS NOT NULL AND
        CASE WHEN jsonb_typeof(${table.reviewSnapshot}) = 'array' THEN jsonb_array_length(${table.reviewSnapshot}) BETWEEN 1 AND 20 ELSE false END)`),
  ],
);

/** Provenance of new free grants. Historical licenses/payments are not backfilled. */
export const resourceAcquisitionEvents = pgTable("resource_acquisition_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Keep the event when a resource or its grant is removed. Private metadata is
  // obtained from current authorization, never from a frozen public title.
  productId: text("product_id").notNull(),
  entitlementId: text("entitlement_id").references(() => entitlements.id, { onDelete: "set null" }),
  source: text("source").$type<"direct" | "cart">().notNull(),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("resource_acquisition_entitlement_idx").on(table.entitlementId),
  index("resource_acquisition_user_created_idx").on(table.userId, table.createdAt.desc(), table.id.desc()),
  index("resource_acquisition_product_created_idx").on(table.productId, table.createdAt.desc(), table.id.desc()),
  check("resource_acquisition_source_check", sql`${table.source} IN ('direct', 'cart')`),
  check("resource_acquisition_request_check", sql`(
    (${table.source} = 'direct' AND ${table.requestId} IS NULL)
    OR (${table.source} = 'cart' AND ${table.requestId} IS NOT NULL AND length(${table.requestId}) BETWEEN 1 AND 128)
  )`),
]);

// 14. Order Items
export const commercialPlans = pgTable("commercial_plans", {
  id: text("id").primaryKey(), slug: text("slug").notNull(),
  scope: text("scope").$type<"user" | "organization">().notNull(),
  status: text("status").$type<CommercialPlanStatus>().notNull().default("draft"),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("commercial_plan_slug_idx").on(table.slug),
  index("commercial_plan_catalog_idx").on(table.status, table.scope, table.createdAt.desc(), table.id.desc()),
  check("commercial_plan_scope_check", sql`${table.scope} IN ('user', 'organization')`),
  check("commercial_plan_status_check", sql`${table.status} IN ('draft', 'published', 'archived')`),
  check("commercial_plan_revision_check", sql`${table.revision} > 0`),
  check("commercial_plan_slug_check", sql`length(${table.slug}) BETWEEN 3 AND 80 AND ${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
]);
export const commercialPlanRevisions = pgTable("commercial_plan_revisions", {
  planId: text("plan_id").notNull().references(() => commercialPlans.id, { onDelete: "restrict" }),
  revision: integer("revision").notNull(),
  terms: jsonb("terms").$type<CommercialPlanTerms>().notNull(),
  status: text("status").$type<CommercialPlanStatus>().notNull(),
  action: text("action").notNull(), actorId: text("actor_id").notNull(), reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.planId, table.revision] }),
  check("commercial_plan_terms_check", sql`jsonb_typeof(${table.terms}) = 'object'
    AND (${table.terms}->>'durationDays')::integer IN (7, 30, 90, 365)
    AND (${table.terms}->>'price')::integer BETWEEN 0 AND 100000000
    AND (${table.terms}->>'currency') IN ('USD', 'EUR', 'RUB')
    AND (${table.terms}->>'commissionBps')::integer BETWEEN 0 AND 1000
    AND length(btrim(${table.terms}->>'titleRu')) BETWEEN 3 AND 100
    AND length(btrim(${table.terms}->>'titleEn')) BETWEEN 3 AND 100
    AND length(btrim(${table.terms}->>'descriptionRu')) BETWEEN 10 AND 2000
    AND length(btrim(${table.terms}->>'descriptionEn')) BETWEEN 10 AND 2000
    AND jsonb_typeof(${table.terms}->'durationDays') = 'number'
    AND jsonb_typeof(${table.terms}->'price') = 'number'
    AND jsonb_typeof(${table.terms}->'commissionBps') = 'number'
    AND jsonb_typeof(${table.terms}->'currency') = 'string'
    AND jsonb_typeof(${table.terms}->'titleRu') = 'string'
    AND jsonb_typeof(${table.terms}->'titleEn') = 'string'
    AND jsonb_typeof(${table.terms}->'descriptionRu') = 'string'
    AND jsonb_typeof(${table.terms}->'descriptionEn') = 'string'
    AND ${table.terms} ?& ARRAY['durationDays', 'price', 'currency', 'commissionBps', 'titleRu', 'titleEn', 'descriptionRu', 'descriptionEn']`),
  check("commercial_plan_snapshot_check", sql`${table.revision} > 0 AND ${table.status} IN ('draft', 'published', 'archived')
    AND ${table.action} IN ('create', 'save', 'publish', 'archive', 'restore') AND length(btrim(${table.reason})) BETWEEN 5 AND 1000`),
]);
export const commercialPlanReviews = pgTable("commercial_plan_reviews", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(), requestId: uuid("request_id").notNull(),
  subjectType: text("subject_type").$type<"user" | "organization">().notNull(), subjectId: text("subject_id").notNull(),
  planId: text("plan_id").notNull(), planRevision: integer("plan_revision").notNull(),
  grossAmount: integer("gross_amount").notNull(), currency: text("currency").$type<"USD" | "EUR" | "RUB">().notNull(),
  // BEFORE INSERT records this value; callers must leave it at the NULL default.
  termsSnapshot: jsonb("terms_snapshot").$type<CommercialPlanTerms>().notNull().default(sql`NULL`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  foreignKey({columns:[table.planId,table.planRevision],foreignColumns:[commercialPlanRevisions.planId,commercialPlanRevisions.revision]}).onDelete("restrict"),
  unique("commercial_plan_reviews_actor_id_request_id_key").on(table.actorId,table.requestId),
  index("commercial_plan_reviews_account_idx").on(table.subjectType,table.subjectId,table.createdAt.desc(),table.id.desc()),
  check("commercial_plan_reviews_subject_type_check",sql`${table.subjectType} IN ('user','organization')`),
  check("commercial_plan_reviews_gross_amount_check",sql`${table.grossAmount} BETWEEN 0 AND 100000000`),
  check("commercial_plan_reviews_currency_check",sql`${table.currency} IN ('USD','EUR','RUB')`),
  check("commercial_plan_reviews_terms_check",sql`(jsonb_typeof(${table.termsSnapshot}) = 'object'
    AND ${table.termsSnapshot} ?& ARRAY['titleRu','titleEn','descriptionRu','descriptionEn','price','currency','durationDays','commissionBps']
    AND jsonb_typeof(${table.termsSnapshot}->'titleRu')='string' AND length(btrim(${table.termsSnapshot}->>'titleRu')) BETWEEN 3 AND 100
    AND jsonb_typeof(${table.termsSnapshot}->'titleEn')='string' AND length(btrim(${table.termsSnapshot}->>'titleEn')) BETWEEN 3 AND 100
    AND jsonb_typeof(${table.termsSnapshot}->'descriptionRu')='string' AND length(btrim(${table.termsSnapshot}->>'descriptionRu')) BETWEEN 10 AND 2000
    AND jsonb_typeof(${table.termsSnapshot}->'descriptionEn')='string' AND length(btrim(${table.termsSnapshot}->>'descriptionEn')) BETWEEN 10 AND 2000
    AND jsonb_typeof(${table.termsSnapshot}->'price')='number' AND (${table.termsSnapshot}->>'price')::integer BETWEEN 0 AND 100000000
    AND jsonb_typeof(${table.termsSnapshot}->'commissionBps')='number' AND (${table.termsSnapshot}->>'commissionBps')::integer BETWEEN 0 AND 1000
    AND jsonb_typeof(${table.termsSnapshot}->'durationDays')='number' AND (${table.termsSnapshot}->>'durationDays')::integer IN (7,30,90,365)
    AND jsonb_typeof(${table.termsSnapshot}->'currency')='string' AND ${table.termsSnapshot}->>'currency' IN ('USD','EUR','RUB')) IS TRUE`),
]);

export const orderCancellationReceipts = pgTable("order_cancellation_receipts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  expectedUpdatedAt: timestamp("expected_updated_at", { withTimezone: true }).notNull(),
  reason: text("reason").notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }).notNull(),
}, table => [
  primaryKey({ columns: [table.userId, table.requestId] }),
  index("order_cancellation_order_idx").on(table.orderId),
  check("order_cancellation_reason_check", sql`length(btrim(${table.reason})) BETWEEN 5 AND 1000`),
]);

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  unitPrice: integer("unit_price").notNull(),
  currency: text("currency").notNull().default("USD"),
  commercialSnapshot: jsonb("commercial_snapshot").$type<import("@nexus/domain").OrderLineTerms>(),
}, table => [
  index("order_items_order_id_item_id_idx").on(table.orderId, table.id),
  index("order_items_product_order_id_idx").on(table.productId, table.orderId, table.id),
  index("order_items_recorded_seller_idx").on(sql`(${table.commercialSnapshot}->'seller'->>'type')`, sql`(${table.commercialSnapshot}->'seller'->>'id')`, table.orderId, table.id).where(sql`${table.commercialSnapshot} IS NOT NULL`),
]);

// Library preferences carry no access grant and never represent installation.
export const resourceLibrarySelections = pgTable("resource_library_selections", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  mode: text("mode").$type<"latest" | "fixed">().notNull(),
  // Preserve a withdrawn/deleted build selection so it is reported unavailable.
  buildId: text("build_id"),
  revision: integer("revision").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.userId, table.productId] }),
  check("resource_library_selection_revision_check", sql`${table.revision} > 0`),
  check("resource_library_selection_mode_check", sql`(${table.mode} = 'latest' AND ${table.buildId} IS NULL) OR
    (${table.mode} = 'fixed' AND ${table.buildId} IS NOT NULL AND length(${table.buildId}) BETWEEN 1 AND 128 AND ${table.buildId} ~ '^[A-Za-z0-9_-]+$')`),
]);

// 15. Payments
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  provider: text("provider").notNull(),
  providerTransactionId: text("provider_transaction_id"),
  status: text("status").notNull().default("pending"), // pending, authorized, completed, failed, refunded, partially_refunded, disputed, cancelled
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("payments_order_created_id_idx").on(table.orderId, table.createdAt.desc(), table.id.desc())]);

// Idempotent balanced journal batches; legacy entries remain distinguishable.
export const ledgerPostingBatches = pgTable("ledger_posting_batches", {
  id: text("id").primaryKey(), fingerprint: text("fingerprint").notNull(),
  createdTransaction: text("created_transaction").notNull().default(sql`txid_current()::text`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [check("ledger_batch_fingerprint_check", sql`${table.fingerprint} ~ '^[a-f0-9]{64}$'`)]);

// 16. Append-Only Financial Ledger
export const ledgerEntries = pgTable("ledger_entries", {
  batchId: text("batch_id").references(() => ledgerPostingBatches.id, { onDelete: "restrict" }),
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  amount: integer("amount").notNull(), // positive = credit, negative = debit
  currency: text("currency").notNull().default("USD"),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [index("ledger_entries_reference_idx").on(table.referenceId, table.referenceType),
  index("ledger_entries_account_currency_time_idx").on(table.accountId, table.currency, table.createdAt.desc(), table.id.desc()),
  index("ledger_entries_batch_idx").on(table.batchId),
]);

// 17. Content Engine (Articles, devlogs, announcements, reviews)
export const content = pgTable(
  "content",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    body: text("body").notNull(),
    excerpt: text("excerpt"),
    coverImageUrl: text("cover_image_url"),
    type: text("type").notNull().default("article"),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverId: text("server_id").references(() => servers.id, { onDelete: "set null" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("published"),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_slug_idx").on(table.slug),
    index("content_author_idx").on(table.authorId),
    index("content_public_feed_time_id_idx")
      .on(sql`coalesce(${table.publishedAt}, ${table.createdAt}) DESC`, table.id.desc())
      .where(sql`${table.status} = 'published'`),
    index("content_public_author_feed_time_id_idx")
      .on(table.authorId, sql`coalesce(${table.publishedAt}, ${table.createdAt}) DESC`, table.id.desc())
      .where(sql`${table.status} = 'published'`),
    index("content_public_org_feed_time_id_idx")
      .on(table.organizationId, sql`coalesce(${table.publishedAt}, ${table.createdAt}) DESC`, table.id.desc())
      .where(sql`${table.status} = 'published'`),
    index("content_public_org_published_id_idx")
      .on(table.organizationId, sql`coalesce(${table.publishedAt}, ${table.updatedAt}) DESC`, table.id.desc())
      .where(sql`${table.status} = 'published'`),
    index("content_type_idx").on(table.type),
    index("content_status_created_id_idx").on(table.status, table.createdAt, table.id),
  ]
);

// 18. Comments
export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    contentId: text("content_id").references(() => content.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    text: text("text").notNull(),
    isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
    reviewStatus: text("review_status").notNull().default("published"),
    reviewRevision: integer("review_revision").notNull().default(1),
    reviewUpdatedAt: timestamp("review_updated_at", { withTimezone: true }),
    reviewAccessSource: text("review_access_source"),
    reviewModerationReason: text("review_moderation_reason"),
    rating: integer("rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Nullable product_id keeps article comments independent while enforcing
    // one product review per author for non-null product_id rows.
    uniqueIndex("comments_product_author_idx").on(table.productId, table.authorId),
    check("comments_review_status_check", sql`${table.reviewStatus} IN ('published', 'withdrawn', 'removed')`),
    check("comments_review_revision_check", sql`${table.reviewRevision} > 0`),
    check("comments_review_source_check", sql`${table.reviewAccessSource} IS NULL OR ${table.reviewAccessSource} IN ('entitlement', 'license')`),
    check("comments_review_target_check", sql`${table.productId} IS NULL OR (${table.contentId} IS NULL AND ${table.parentId} IS NULL AND (${table.reviewStatus} <> 'published' OR (${table.rating} BETWEEN 1 AND 5 AND ${table.rating} IS NOT NULL)))`),
    index("comments_product_public_time_id_idx").on(table.productId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.productId} IS NOT NULL AND ${table.contentId} IS NULL AND ${table.reviewStatus} = 'published'`),
    index("comments_review_author_time_id_idx").on(table.authorId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.productId} IS NOT NULL AND ${table.contentId} IS NULL`),
    index("comments_content_created_id_idx")
      .on(table.contentId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.productId} IS NULL AND ${table.contentId} IS NOT NULL`),
  ]
);

// 19. Reactions
export const reactions = pgTable("reactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 20. Follows
export const follows = pgTable(
  "follows",
  {
    id: text("id").primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("unique_follow_idx").on(table.followerId, table.targetType, table.targetId),
    index("follows_follower_created_id_idx").on(table.followerId, table.createdAt.desc(), table.id.desc()),
  ]
);

// 21. Notifications
export const notifications = pgTable("notifications", {
  data: jsonb("data").$type<BuildReviewNotificationData | LicenseTermNotificationData | ResourceReleaseNoticeData>(),
  id: text("id").primaryKey(),
  recipientId: text("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  type: text("type").notNull().default("system"),
  category: text("category").notNull().default("system"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("notifications_recipient_created_id_idx")
    .on(table.recipientId, table.createdAt.desc(), table.id.desc()),
  index("notifications_unread_recipient_created_id_idx")
    .on(table.recipientId, table.createdAt.desc(), table.id.desc())
    .where(sql`${table.isRead} = false`),
]);

// 22. Notification Preferences
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    followsEnabled: boolean("follows_enabled").notNull().default(true),
    contentEnabled: boolean("content_enabled").notNull().default(true),
    serverEnabled: boolean("server_enabled").notNull().default(true),
    commerceEnabled: boolean("commerce_enabled").notNull().default(true),
    systemEnabled: boolean("system_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("notification_preferences_user_idx").on(table.userId)]
);

// 23. Web Push Subscriptions
export const webPushSubscriptions = pgTable(
  "web_push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    expirationAt: timestamp("expiration_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("web_push_subscriptions_endpoint_idx").on(table.endpoint),
    index("web_push_subscriptions_user_idx").on(table.userId),
    index("web_push_subscriptions_session_idx").on(table.sessionId),
  ],
);

// 23b. Durable Web Push Outbox
export const webPushQueueGate = pgTable(
  "web_push_queue_gate",
  {
    singleton: boolean("singleton").primaryKey().default(true),
    capacity: integer("capacity").notNull().default(10_000),
  },
  (table) => [
    check("web_push_queue_gate_singleton", sql`${table.singleton} = true`),
    check(
      "web_push_queue_capacity_bounds",
      sql`${table.capacity} between 1 and 50000`,
    ),
  ],
);

export const webPushOutbox = pgTable(
  "web_push_outbox",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => webPushSubscriptions.id, { onDelete: "cascade" }),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseTokenDigest: text("lease_token_digest"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '24 hours'`),
  },
  (table) => [
    uniqueIndex("web_push_outbox_notification_subscription_idx").on(
      table.notificationId,
      table.subscriptionId,
    ),
    index("web_push_outbox_due_idx").on(table.availableAt, table.id),
    index("web_push_outbox_lease_idx").on(table.leaseExpiresAt),
    index("web_push_outbox_expiry_idx").on(table.expiresAt),
    check(
      "web_push_outbox_attempts_bounds",
      sql`${table.attempts} between 0 and 5`,
    ),
    check(
      "web_push_outbox_expiry_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "web_push_outbox_status_bounds",
      sql`${table.lastStatusCode} is null or (${table.lastStatusCode} between 100 and 599)`,
    ),
  ],
);


// 24. Audit Events
export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  actorType: text("actor_type").notNull().default("user"),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  targetType: text("target_type").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: jsonb("details").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_events_target_created_id_idx").on(table.targetType, table.targetId, table.createdAt.desc(), table.id.desc()),
  index("audit_events_download_activity_idx").on(table.targetId, table.createdAt.desc(), table.id.desc())
    .where(sql`${table.targetType} = 'product' AND ${table.action} = 'product.download_started'`),
]);

// 24. Reports
export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  type: text("type").notNull(),
  reason: text("reason").notNull(),
  evidenceUrls: jsonb("evidence_urls").$type<string[]>().default([]).notNull(),
  status: text("status").notNull().default("open"),
  moderatorNotes: text("moderator_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("reports_status_created_id_idx").on(table.status, table.createdAt, table.id),
  index("reports_review_queue_idx").on(table.status, table.createdAt, table.id).where(sql`${table.targetType} = 'review'`),
  index("reports_status_resolved_id_idx").on(table.status, table.resolvedAt, table.id),
  index("reports_reporter_created_id_idx").on(table.reporterId, table.createdAt.desc(), table.id.desc()),
  index("reports_reporter_pending_target_idx")
    .on(table.reporterId, table.targetType, table.targetId)
    .where(sql`${table.status} IN ('open', 'under_review')`),
]);

// 25. Unified Support
export const supportCases = pgTable(
  "support_cases",
  {
    id: text("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").$type<SupportCaseCategory>().notNull(),
    subject: text("subject").notNull(),
    status: text("status").$type<SupportCaseStatus>().notNull().default("open"),
    relatedType: text("related_type").$type<SupportRelatedType>(),
    relatedId: text("related_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "support_cases_category_check",
      sql`${table.category} IN (${sql.raw(
        SUPPORT_CASE_CATEGORIES.map((value) => `'${value}'`).join(", "),
      )})`,
    ),
    check(
      "support_cases_status_check",
      sql`${table.status} IN (${sql.raw(
        SUPPORT_CASE_STATUSES.map((value) => `'${value}'`).join(", "),
      )})`,
    ),
    check(
      "support_cases_related_type_check",
      sql`${table.relatedType} IS NULL OR ${table.relatedType} IN (${sql.raw(
        SUPPORT_RELATED_TYPES.map((value) => `'${value}'`).join(", "),
      )})`,
    ),
    check(
      "support_cases_related_pair_check",
      sql`(${table.relatedType} IS NULL AND ${table.relatedId} IS NULL) OR (${table.relatedType} IS NOT NULL AND ${table.relatedId} IS NOT NULL)`,
    ),
    index("support_cases_requester_updated_id_idx").on(
      table.requesterId,
      table.updatedAt,
      table.id,
    ),
    index("support_cases_status_updated_id_idx").on(
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("support_cases_category_status_updated_id_idx").on(
      table.category,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("support_cases_updated_id_idx").on(
      table.updatedAt,
      table.id,
    ),
  ],
);

export const supportCaseMessages = pgTable(
  "support_case_messages",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => supportCases.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorRole: text("author_role")
      .$type<SupportMessageAuthorRole>()
      .notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "support_case_messages_author_role_check",
      sql`${table.authorRole} IN ('requester', 'staff')`,
    ),
    index("support_case_messages_case_created_id_idx").on(
      table.caseId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const supportMutationRequests = pgTable(
  "support_mutation_requests",
  {
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestKey: text("request_key").notNull(),
    operation: text("operation").$type<"case" | "reply">().notNull(),
    fingerprint: text("fingerprint").notNull(),
    caseId: text("case_id").notNull(),
    messageId: text("message_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: "support_mutation_requests_actor_request_pk",
      columns: [table.actorId, table.requestKey],
    }),
    check(
      "support_mutation_requests_operation_check",
      sql`${table.operation} IN ('case', 'reply')`,
    ),
    check(
      "support_mutation_requests_key_check",
      sql`length(${table.requestKey}) = 36`,
    ),
    check(
      "support_mutation_requests_fingerprint_check",
      sql`length(${table.fingerprint}) = 64`,
    ),
  ],
);

// 26. Moderation Cases
export const moderationCases = pgTable("moderation_cases", {
  id: text("id").primaryKey(),
  reportId: text("report_id").references(() => reports.id, { onDelete: "set null" }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  status: text("status").notNull().default("pending_review"),
  moderatorId: text("moderator_id").references(() => users.id, { onDelete: "set null" }),
  actionTaken: text("action_taken"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 26. Verification Requests (Trust Layer — admin review workflow)
export const verificationRequests = pgTable("verification_requests", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // user, developer, organization, server
  targetId: text("target_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  proofUrl: text("proof_url"),
  notes: text("notes"),
  reviewerId: text("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("verification_status_created_id_idx").on(table.status, table.createdAt, table.id),
  index("verification_requests_requester_created_id_idx").on(table.requesterId, table.createdAt.desc(), table.id.desc()),
  index("verification_status_resolved_id_idx").on(table.status, table.resolvedAt, table.id),
  index("verification_requests_target_created_id_idx").on(table.targetType, table.targetId, table.createdAt.desc(), table.id.desc()),
]);


export const serverClaimChallenges = pgTable(
  "server_claim_challenges",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenDigest: text("token_digest").notNull(),
    proofVersion: integer("proof_version").notNull().default(1),
    // Legacy proof rows are NULL, and cannot be used after migration 0034.
    endpointRevision: integer("endpoint_revision"),
    // Snapshot, intentionally without an FK: organization deletion must invalidate old proof.
    claimScopeRecorded: boolean("claim_scope_recorded").notNull().default(false),
    claimOrganizationId: text("claim_organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    sourceFetchedAt: timestamp("source_fetched_at", { withTimezone: true }),
    verificationRequestId: text("verification_request_id"),
  },
  (table) => [
    uniqueIndex("server_claim_challenge_digest_unique").on(table.tokenDigest),
    uniqueIndex("server_claim_challenge_active_requester_unique")
      .on(table.serverId, table.requesterId)
      .where(sql`${table.consumedAt} is null and ${table.revokedAt} is null`),
    uniqueIndex("server_claim_challenge_verification_unique").on(
      table.verificationRequestId,
    ),
    index("server_claim_challenge_server_idx").on(table.serverId, table.createdAt),
    index("server_claim_challenge_expiry_idx").on(table.expiresAt),
    check(
      "server_claim_challenge_id_check",
      sql`${table.id} ~ '^scc_[0-9a-f-]{36}$'`,
    ),
    check(
      "server_claim_challenge_digest_check",
      sql`${table.tokenDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "server_claim_endpoint_revision_nonnegative",
      sql`${table.endpointRevision} is null or ${table.endpointRevision} >= 0`,
    ),
    check(
      "server_claim_scope_recorded_check",
      sql`${table.claimScopeRecorded} or ${table.claimOrganizationId} is null`,
    ),
    check(
      "server_claim_challenge_version_check",
      sql`${table.proofVersion} = 1`,
    ),
    check(
      "server_claim_challenge_expiry_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "server_claim_challenge_terminal_check",
      sql`not (${table.consumedAt} is not null and ${table.revokedAt} is not null)`,
    ),
    check(
      "server_claim_challenge_evidence_check",
      sql`(
        ${table.consumedAt} is null
        and ${table.sourceFetchedAt} is null
        and ${table.verificationRequestId} is null
      ) or (
        ${table.consumedAt} is not null
        and ${table.sourceFetchedAt} is not null
        and ${table.verificationRequestId} is not null
      )`,
    ),
  ],
);

// Shared privacy model; preference writes must also advance users.updatedAt.
export const userProfilePreferences = pgTable("user_profile_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  showActivity: boolean("show_activity").notNull().default(true),
  showProfessionalContacts: boolean("show_professional_contacts").notNull().default(true),
});

// Immutable purchase context; correspondence uses the existing support system.
export const commerceOrderCases = pgTable("commerce_order_cases", {
  caseId: text("case_id").primaryKey().references(() => supportCases.id, { onDelete: "restrict" }),
  orderId: text("order_id").notNull().unique("commerce_order_cases_order_id_key").references(() => orders.id, { onDelete: "restrict" }),
  kind: text("kind").$type<OrderCaseKind>().notNull(),
  reviewStatus: text("review_status").$type<OrderCaseReviewStatus>().notNull().default("intake"),
  revision: integer("revision").notNull().default(1),
  requestedAmount: integer("requested_amount"), currency: text("currency").notNull(),
  snapshot: jsonb("snapshot").$type<OrderCaseEvidence>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("commerce_order_cases_review_time_id_idx").on(table.reviewStatus, table.createdAt, table.caseId),
  check("commerce_order_cases_kind_check", sql`${table.kind} IN ('payment_issue','resource_issue','refund_request','dispute')`),
  check("commerce_order_cases_review_status_check", sql`${table.reviewStatus} IN ('intake','reviewing','awaiting_buyer','refund_recommended','refund_declined','resolved','dismissed')`),
  check("commerce_order_cases_revision_check", sql`${table.revision} > 0`),
  check("commerce_order_cases_requested_amount_check", sql`${table.requestedAmount} > 0`),
  check("commerce_order_cases_amount_kind_check", sql`(${table.kind} = 'refund_request' AND ${table.requestedAmount} IS NOT NULL)
    OR ${table.kind} = 'dispute' OR (${table.kind} IN ('payment_issue','resource_issue') AND ${table.requestedAmount} IS NULL)`),
  check("commerce_order_cases_snapshot_check", sql`coalesce(jsonb_typeof(${table.snapshot}) = 'object'
    AND ${table.snapshot}->>'confirmation' = 'recorded_only'
    AND jsonb_typeof(${table.snapshot}->'payments') = 'array' AND jsonb_array_length(${table.snapshot}->'payments') <= 20, false)`),
]);

// Private server evidence; resource/build snapshots confer no access.
export const resourceDeliveryReceipts = pgTable("resource_delivery_receipts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull(), buildId: text("build_id").notNull(),
  version: text("version").notNull(), sha256Hash: text("sha256_hash").notNull(),
  expectedBytes: integer("expected_bytes").notNull(), pinned: boolean("pinned").notNull(),
  accessSource: text("access_source").$type<"manager" | "entitlement" | "license">().notNull(),
  status: text("status").$type<ResourceDeliveryStatus>().notNull().default("started"),
  bytesSent: integer("bytes_sent").notNull().default(0),
  errorCode: text("error_code").$type<ResourceDeliveryError>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, table => [
  index("resource_delivery_user_time_id_idx").on(table.userId, table.startedAt.desc(), table.id.desc()),
  index("resource_delivery_user_status_time_id_idx").on(table.userId, table.status, table.startedAt.desc(), table.id.desc()),
  index("resource_delivery_user_resource_time_id_idx").on(table.userId, table.resourceId, table.startedAt.desc(), table.id.desc()),
  index("resource_delivery_resource_time_id_idx").on(table.resourceId, table.startedAt.desc(), table.id.desc()),
  check("resource_delivery_size_check", sql`${table.expectedBytes} BETWEEN 1 AND 67108864 AND ${table.bytesSent} BETWEEN 0 AND ${table.expectedBytes}`),
  check("resource_delivery_hash_check", sql`${table.sha256Hash} ~ '^[a-f0-9]{64}$'`),
  check("resource_delivery_source_check", sql`${table.accessSource} IN ('manager','entitlement','license')`),
  check("resource_delivery_state_check", sql`(${table.status} = 'started' AND ${table.bytesSent} = 0 AND ${table.finishedAt} IS NULL AND ${table.errorCode} IS NULL) OR (${table.status} = 'served' AND ${table.bytesSent} = ${table.expectedBytes} AND ${table.finishedAt} IS NOT NULL AND ${table.errorCode} IS NULL) OR (${table.status} = 'cancelled' AND ${table.finishedAt} IS NOT NULL AND ${table.errorCode} IS NULL) OR (${table.status} = 'failed' AND ${table.finishedAt} IS NOT NULL AND ${table.errorCode} IS NOT NULL AND ${table.errorCode} IN ('storage_error','size_mismatch','hash_mismatch'))`),
  check("resource_delivery_time_check", sql`isfinite(${table.startedAt}) AND (${table.finishedAt} IS NULL OR (isfinite(${table.finishedAt}) AND ${table.finishedAt} >= ${table.startedAt}))`),
]);

export const resourceReleaseEvents = pgTable("resource_release_events", {
  sequence: bigserial("sequence", { mode: "bigint" }).primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  buildId: text("build_id").notNull().unique().references(() => builds.id, { onDelete: "cascade" }),
  version: text("version").notNull(), sha256Hash: text("sha256_hash").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("resource_release_product_sequence_idx").on(table.productId, table.sequence),
  check("resource_release_events_sha256_hash_check", sql`${table.sha256Hash} ~ '^[a-f0-9]{64}$'`),
  check("resource_release_events_file_size_bytes_check", sql`${table.fileSizeBytes} BETWEEN 1 AND 67108864`),
]);
export const resourceReleaseWatches = pgTable("resource_release_watches", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull(), revision: integer("revision").notNull(),
  lastSequence: bigint("last_sequence", { mode: "bigint" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.userId, table.productId] }),
  index("resource_release_watch_user_time_idx").on(table.userId, table.updatedAt.desc(), table.productId),
  index("resource_release_watch_pending_idx").on(table.productId, table.lastSequence, table.userId).where(sql`${table.enabled}`),
  check("resource_release_watches_revision_check", sql`${table.revision} > 0`),
  check("resource_release_watches_last_sequence_check", sql`${table.lastSequence} >= 0`),
]);

export const storageMaintenanceObjects = pgTable("storage_maintenance_objects", {
  id: text("id").primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  identity: jsonb("identity").$type<StorageObjectIdentity>().notNull(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull(),
  state: text("state").$type<StorageMaintenanceState>().notNull().default("observed"),
  revision: integer("revision").notNull().default(1),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  leaseToken: text("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  requestedBy: text("requested_by").references(() => users.id, { onDelete: "set null" }),
  resultCode: text("result_code"),
}, (table) => [
  index("storage_maintenance_state_modified_idx").on(table.state, table.modifiedAt, table.id),
  check("storage_maintenance_objects_id_check", sql`${table.id} ~ '^smo_[a-f0-9]{24}$'`),
  check("storage_maintenance_objects_modified_at_check", sql`isfinite(${table.modifiedAt})`),
  check("storage_maintenance_objects_revision_check", sql`${table.revision} > 0`),
  check("storage_maintenance_objects_state_check", sql`${table.state} IN ('observed','retired','deleted','missing','changed','failed')`),
  check("storage_maintenance_objects_result_code_check", sql`${table.resultCode} IS NULL OR length(${table.resultCode}) <= 80`),
  check("storage_maintenance_identity_check", sql`COALESCE(
    jsonb_typeof(${table.identity}) = 'object' AND octet_length(${table.identity}::text) <= 2048 AND
    ${table.storageKey} ~ '^assets/[A-Za-z0-9_-]{1,128}/ast_[A-Za-z0-9_-]{1,100}\\.(zip|rar|7z|lua|luac|dff|txd|col|png|jpg|jpeg|webp|json|map)$' AND
    jsonb_typeof(${table.identity}->'sizeBytes') = 'number' AND
    (${table.identity}->>'modifiedAt')::timestamptz = ${table.modifiedAt} AND
    ${table.identity}->>'key' = ${table.storageKey} AND ${table.identity}->>'sha256Hash' ~ '^[a-f0-9]{64}$' AND
    (${table.identity}->>'sizeBytes')::bigint BETWEEN 1 AND 67108864 AND
    ${table.identity}->>'device' ~ '^[0-9]+$' AND ${table.identity}->>'inode' ~ '^[0-9]+$' AND
    ${table.identity}->>'mtimeNs' ~ '^-?[0-9]+$' AND ${table.identity}->>'ctimeNs' ~ '^-?[0-9]+$',false)`),
  check("storage_maintenance_retirement_check", sql`COALESCE(
    (${table.state} = 'observed' AND ${table.retiredAt} IS NULL AND ${table.leaseToken} IS NULL AND ${table.leaseExpiresAt} IS NULL) OR
    (${table.state} <> 'observed' AND ${table.retiredAt} IS NOT NULL AND isfinite(${table.retiredAt}) AND
      ((${table.leaseToken} IS NULL AND ${table.leaseExpiresAt} IS NULL) OR
       (${table.state} = 'retired' AND ${table.leaseToken} ~ '^sml_[a-f0-9]{24}$' AND ${table.leaseExpiresAt} IS NOT NULL AND isfinite(${table.leaseExpiresAt})))),false)`),
]);
