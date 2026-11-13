import type { Build } from "@nexus/domain";

export type PendingReviewBuild = Build & {
  productTitle: string;
  productSlug: string;
  productStatus: string;
  publisherId: string;
  publisherUsername: string;
};

export type RiskReviewBuild = PendingReviewBuild;
