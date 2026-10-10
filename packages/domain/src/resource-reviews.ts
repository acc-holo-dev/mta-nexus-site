export type ResourceReviewStatus = "published" | "withdrawn" | "removed";
export type ResourceReviewSource = "entitlement" | "license" | "legacy";
export type ResourceReviewCommand =
  | { action: "save"; expectedRevision: number; text: string; rating: number }
  | { action: "withdraw"; expectedRevision: number };
export type ResourceReviewDecision = {
  action: "review" | "resolve" | "dismiss" | "remove_review";
  expectedStatus: "open" | "under_review";
  notes: string;
  expectedRevision?: number;
};
export type ResourceReviewView = {
  id: string;
  text: string;
  rating: number | null;
  status: ResourceReviewStatus;
  revision: number;
  accessSource: ResourceReviewSource;
  createdAt: Date;
  updatedAt: Date | null;
  author: { username: string; displayName: string } | null;
};
