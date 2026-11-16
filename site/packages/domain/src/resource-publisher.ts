import type { ProductStatus, ProductType } from "./entities";
export const RESOURCE_READINESS = [
  "ready",
  "published",
  "in_review",
  "no_build",
  "needs_version",
  "restricted",
] as const;
export type ResourceReadiness = (typeof RESOURCE_READINESS)[number];
export type PublisherResourceQuery = {
  status: ProductStatus | "all";
  type: ProductType | "all";
  scope: "all" | "personal" | "organization";
  readiness: ResourceReadiness | "all";
  q: string;
  sort: "updated" | "created" | "title";
};
export type PublisherHistoryKind = "all" | "changes" | "publication";
