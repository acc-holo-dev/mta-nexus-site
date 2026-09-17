// Domain State Enums & Types

export type UserRole = "user" | "developer" | "server_owner" | "moderator" | "admin";

export type OrgRole = "owner" | "admin" | "developer" | "member";

export type ServerStatus = "active" | "inactive" | "maintenance" | "suspended";

export type ServerVisibility = "public" | "unlisted" | "private";

export type InstallationStatus = "pending" | "active" | "revoked" | "offline";

export type ProductType =
  | "script"
  | "model"
  | "vehicle"
  | "map"
  | "ui"
  | "plugin"
  | "api"
  | "service"
  | "bundle";

export type ProductStatus = "draft" | "pending_review" | "published" | "suspended" | "archived";

export type LicenseModel =
  | "single_server"
  | "multiple_servers"
  | "per_installation"
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
  ipAddress: string;
  port: number;
  httpPort?: number;
  gameMode?: string;
  mapName?: string;
  maxPlayers: number;
  currentPlayers: number;
  ownerId: string;
  organizationId?: string;
  status: ServerStatus;
  visibility: ServerVisibility;
  isVerified: boolean;
  bannerUrl?: string;
  logoUrl?: string;
  lastHeartbeatAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerInstallation {
  id: string;
  serverId: string;
  apiKeyHash: string;
  moduleVersion: string;
  mtaVersion: string;
  os: string;
  status: InstallationStatus;
  lastHeartbeatAt?: Date;
  capabilities: string[];
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
    moduleMinVersion?: string;
    dependencies?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Build {
  id: string;
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
  targetType: "user" | "server" | "organization" | "product";
  targetId: string;
  createdAt: Date;
}

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

export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  link?: string;
  type: "system" | "order" | "license" | "content" | "server" | "security";
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
  targetType: "product" | "server" | "content" | "user";
  targetId: string;
  type: ReportType;
  reason: string;
  evidenceUrls: string[];
  status: ReportStatus;
  moderatorNotes?: string;
  createdAt: Date;
  resolvedAt?: Date;
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
