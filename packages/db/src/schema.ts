import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
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
    ipAddress: text("ip_address").notNull(),
    port: integer("port").notNull().default(22003),
    httpPort: integer("http_port").default(22005),
    gameMode: text("game_mode"),
    mapName: text("map_name"),
    maxPlayers: integer("max_players").notNull().default(128),
    currentPlayers: integer("current_players").notNull().default(0),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"), // active, inactive, maintenance, suspended
    visibility: text("visibility").notNull().default("public"), // public, unlisted, private
    isVerified: boolean("is_verified").notNull().default(false),
    bannerUrl: text("banner_url"),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("servers_slug_idx").on(table.slug),
    index("servers_status_idx").on(table.status),
    index("servers_owner_idx").on(table.ownerId),
  ]
);

// 7. Server Installations (Nexus Module runtime binding)
export const serverInstallations = pgTable("server_installations", {
  id: text("id").primaryKey(),
  serverId: text("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  apiKeyHash: text("api_key_hash").notNull(),
  moduleVersion: text("module_version").notNull().default("1.0.0"),
  mtaVersion: text("mta_version").notNull().default("1.6.0"),
  os: text("os").notNull().default("linux"),
  status: text("status").notNull().default("pending"), // pending, active, revoked, offline
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  capabilities: jsonb("capabilities").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 8. Products
export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull(),
    shortDescription: text("short_description"),
    type: text("type").notNull(), // script, model, vehicle, map, ui, plugin, api, service, bundle
    status: text("status").notNull().default("draft"), // draft, pending_review, published, suspended, archived
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
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
      .$type<{ mtaMinVersion?: string; moduleMinVersion?: string; dependencies?: string[] }>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("products_slug_idx").on(table.slug),
    index("products_type_idx").on(table.type),
    index("products_status_idx").on(table.status),
    index("products_author_idx").on(table.authorId),
    index("products_featured_idx").on(table.isFeatured),
  ]
);

// 9. Builds
export const builds = pgTable("builds", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  releaseNotes: text("release_notes"),
  status: text("status").notNull().default("draft"), // draft, testing, published, deprecated, retired
  storageKey: text("storage_key").notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  mtaVersionTarget: text("mta_version_target"),
  isSigned: boolean("is_signed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
});

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
  ]
);

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
});

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

// 14. Order Items
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
});

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
});

// 16. Append-Only Financial Ledger
export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  amount: integer("amount").notNull(), // positive = credit, negative = debit
  currency: text("currency").notNull().default("USD"),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    index("content_type_idx").on(table.type),
  ]
);

// 18. Comments
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  contentId: text("content_id").references(() => content.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  text: text("text").notNull(),
  isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
  rating: integer("rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  ]
);

// 21. Notifications
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  type: text("type").notNull().default("system"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 22. Audit Events
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
});

// 23. Reports
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
});

// 24. Moderation Cases
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

// 25. Verification Requests (Trust Layer — admin review workflow)
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
});

// 26. Server Heartbeats (Telemetry & Analytics Foundation)
export const serverHeartbeats = pgTable("server_heartbeats", {
  id: text("id").primaryKey(),
  installationId: text("installation_id")
    .notNull()
    .references(() => serverInstallations.id, { onDelete: "cascade" }),
  serverId: text("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("online"), // online, offline, maintenance
  currentPlayers: integer("current_players").notNull().default(0),
  maxPlayers: integer("max_players").notNull().default(0),
  moduleVersion: text("module_version"),
  mtaVersion: text("mta_version"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});
