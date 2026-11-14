export type ResourceCartReviewItem = {
  productId: string;
  available: boolean;
  alreadyOwned: boolean;
  title: string | null;
  slug: string | null;
  buildId: string | null;
  version: string | null;
  sha256Hash: string | null;
  fileSizeBytes: number | null;
  mtaMinVersion: string | null;
  dependencies: string[] | null;
};
export type ResourceCartReview = {
  items: ResourceCartReviewItem[];
  limit: number;
  reviewDigest: string | null;
};
export type ResourceCartReceiptItem = {
  productId: string;
  title: string;
  slug: string;
  buildId: string;
  version: string;
  sha256Hash: string;
  fileSizeBytes: number;
  mtaMinVersion: string | null;
  dependencies: string[];
  alreadyClaimed: boolean;
  accessSource: "entitlement" | "license";
  recordedExpiresAt: string | null;
};
export type ResourceCartReceiptQuery = {
  page: number;
  days: "all" | 7 | 30 | 90 | 365;
  evidence: "all" | "reviewed" | "legacy";
};
