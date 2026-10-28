import type { ProductType } from "./product-types";
import type { BuildPackageEvidence } from "./build-package-evidence";

// Domain State Enums & Types

export type UserRole = "user" | "developer" | "server_owner" | "moderator" | "admin";

export type OrgRole = "owner" | "admin" | "developer" | "member";

export type ServerStatus = "active" | "inactive" | "maintenance" | "suspended";

export type ServerVisibility = "public" | "unlisted" | "private";

export type { ProductType } from "./product-types";

export type ProductStatus = "draft" | "pending_review" | "published" | "suspended" | "archived";

export type LicenseModel =
  | "single_server"
  | "multiple_servers"
  | "organization"
  | "subscription"
  | "unlimited";

export type LicenseStatus = "active" | "expired" | "revoked" | "suspended";

export type BuildStatus =
  | "draft"
  | "testing"
  | "pending_review"
  | "published"
  | "rejected"
  | "deprecated"
  | "quarantined"
  | "retired";

export type BuildScanStatus = "not_scanned" | "clean" | "malicious" | "error";

export type UploadStatus =
  | "initiated"
  | "uploading"
  | "uploaded"
  | "validating"
  | "processing"
  | "ready"
  | "quarantined"
  | "failed"
  | "deleted";

export type OrderStatus = "pending" | "processing" | "completed" | "cancelled" | "refunded";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "completed"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "cancelled";

export type ContentType =
  | "article"
  | "post"
  | "news"
  | "devlog"
  | "update"
  | "announcement"
  | "question"
  | "review";

export type ModerationStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "suspended"
  | "archived";

export type ReportType =
  | "scam"
  | "copyright"
  | "malware"
  | "abuse"
  | "fake_product"
  | "fake_server"
  | "spam"
  | "other";

export type ReportStatus = "open" | "under_review" | "resolved" | "dismissed";

export const SUPPORT_CASE_CATEGORIES = [
  "account",
  "resource",
  "server",
  "purchase",
  "license",
  "payment",
  "seller",
  "integration",
  "other",
] as const;
export type SupportCaseCategory = (typeof SUPPORT_CASE_CATEGORIES)[number];

export const SUPPORT_CASE_STATUSES = ["open", "resolved", "closed"] as const;
export type SupportCaseStatus = (typeof SUPPORT_CASE_STATUSES)[number];

export const SUPPORT_RELATED_TYPES = [
  "product",
  "server",
  "purchase",
  "license",
  "seller",
] as const;
export type SupportRelatedType = (typeof SUPPORT_RELATED_TYPES)[number];

export type SupportMessageAuthorRole = "requester" | "staff";

// Domain Interfaces

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  role: UserRole;
  isVerified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  activeContextId?: string; // personal or orgId
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  isVerified: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  permissions: string[];
  createdAt: Date;
}

export interface DeveloperProfile {
  id: string;
  userId: string;
  specialties: string[];
  githubUrl?: string;
  discordTag?: string;
  reputationScore: number;
  completedDealsCount: number;
  verifiedDeveloper: boolean;
  createdAt: Date;
}

export interface Server {
  id: string;
  name: string;
  slug: string;
  description?: string;
  websiteUrl?: string;
  discordUrl?: string;
  rulesUrl?: string;
  mediaUrls?: string[];
  language?: string;
  region?: string;
  gameplayTags?: string[];
  ipAddress: string;
  port: number;
  httpPort?: number;
  gameMode?: string;
  mapName?: string;
  maxPlayers?: number;
  currentPlayers?: number;
  ownerId?: string;
  organizationId?: string;
  status: ServerStatus;
  visibility: ServerVisibility;
  isVerified: boolean;
  bannerUrl?: string;
  logoUrl?: string;
  lastObservedAt?: Date;
  observationSource?: "mta_master" | "mta_query";
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerObservation {
  id: string;
  serverId: string;
  source: "mta_master" | "mta_query";
  sourceSequence?: string;
  name?: string;
  gameMode?: string;
  mapName?: string;
  mtaVersion?: string;
  currentPlayers?: number;
  maxPlayers?: number;
  passworded?: boolean;
  responding?: boolean;
  observedAt: Date;
  createdAt: Date;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  type: ProductType;
  status: ProductStatus;
  /** Future editorial changes withdraw publication until a clean version is reviewed. */
  metadataReviewRequired?: boolean;
  authorId: string;
  organizationId?: string;
  price: number; // in cents (USD/EUR)
  currency: string;
  licenseModel: LicenseModel;
  tags: string[];
  currentVersion: string;
  ratingAverage: number;
  ratingCount: number;
  salesCount: number;
  isFeatured: boolean;
  thumbnailUrl?: string;
  screenshots: string[];
  compatibility: {
    mtaMinVersion?: string;
    dependencies?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Build {
  packageEvidence?: BuildPackageEvidence | null;
  id: string;
  /** Populated by PostgreSQL; optional only for legacy in-memory fixtures. */
  revision?: number;
  productId: string;
  version: string;
  releaseNotes?: string;
  status: BuildStatus;
  storageKey: string;
  sha256Hash: string;
  fileSizeBytes: number;
  fileName: string;
  mimeType: string;
  scanStatus: BuildScanStatus;
  scanner?: string;
  scannedAt?: Date;
  mtaVersionTarget?: string;
  isSigned: boolean;
  quarantinePreviousStatus?: BuildStatus;
  quarantineReason?: string;
  quarantinedAt?: Date;
  quarantinedBy?: string;
  createdAt: Date;
}

export interface Asset {
  id: string;
  ownerId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  status: UploadStatus;
  isPrivate: boolean;
  createdAt: Date;
}

export interface License {
  id: string;
  key: string;
  productId: string;
  userId: string;
  serverId?: string;
  model: LicenseModel;
  status: LicenseStatus;
  expiresAt?: Date;
  entitlements: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Entitlement {
  id: string;
  subjectType: "user" | "server" | "organization";
  subjectId: string;
  permission: string;
  resourceId: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  unitPrice: number;
  currency: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  provider: string; // e.g. stripe, mock, crypto
  providerTransactionId?: string;
  status: PaymentStatus;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEntry {
  id: string;
  accountId: string; // user:id, org:id, platform:nexus, escrow:id
  amount: number; // positive for credit, negative for debit
  currency: string;
  referenceType: "order" | "fee" | "payout" | "refund";
  referenceId: string;
  balanceAfter: number;
  description: string;
  createdAt: Date;
}

export interface Content {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt?: string;
  coverImageUrl?: string;
  type: ContentType;
  authorId: string;
  serverId?: string;
  productId?: string;
  organizationId?: string;
  status: "draft" | "published" | "archived";
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  contentId?: string;
  productId?: string;
  authorId: string;
  parentId?: string;
  text: string;
  isVerifiedPurchase?: boolean;
  rating?: number; // for product review comments
  createdAt: Date;
}

export interface Reaction {
  id: string;
  userId: string;
  targetType: "content" | "comment" | "product";
  targetId: string;
  emoji: string;
  createdAt: Date;
}

export interface Follow {
  id: string;
  followerId: string;
  targetType: "user" | "server" | "organization" | "product" | "content";
  targetId: string;
  createdAt: Date;
}

export type NotificationCategory =
  | "follow"
  | "content"
  | "server"
  | "commerce"
  | "system"
  | "security";

export interface NotificationPreferences {
  id: string;
  userId: string;
  followsEnabled: boolean;
  contentEnabled: boolean;
  serverEnabled: boolean;
  commerceEnabled: boolean;
  systemEnabled: boolean;
  updatedAt: Date;
}

export interface BuildReviewNotificationData {
  kind: "build_review";
  decision: "approve" | "reject";
  resourceTitle: string;
  version: string;
  notes: string;
}

export interface DiscussionPushNotificationData {
  kind: "discussion_push";
  discussionPush: { version: 1; state: "pending" | "queued" | "unavailable" };
}
export interface Notification {
  data?:
    | BuildReviewNotificationData
    | import("./license-maintenance").LicenseTermNotificationData
    | import("./resource-release-watches").ResourceReleaseNoticeData
    | DiscussionPushNotificationData
    | null;
  id: string;
  recipientId: string;
  title: string;
  message: string;
  link?: string;
  type: "system" | "order" | "license" | "content" | "server" | "security";
  category?: NotificationCategory;
  isRead: boolean;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorType: "user" | "system" | "admin";
  action: string;
  targetId: string;
  targetType: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: "product" | "server" | "content" | "comment" | "user" | "review";
  targetId: string;
  type: ReportType;
  reason: string;
  evidenceUrls: string[];
  status: ReportStatus;
  moderatorNotes?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface SupportCase {
  id: string;
  requesterId: string;
  category: SupportCaseCategory;
  subject: string;
  status: SupportCaseStatus;
  relatedType?: SupportRelatedType;
  relatedId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportCaseMessage {
  id: string;
  caseId: string;
  authorId?: string;
  authorRole: SupportMessageAuthorRole;
  body: string;
  createdAt: Date;
}

export interface ModerationCase {
  id: string;
  reportId?: string;
  targetType: string;
  targetId: string;
  status: ModerationStatus;
  moderatorId?: string;
  actionTaken?: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}
