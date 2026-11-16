import type { ProductType } from "./entities";
export const RESOURCE_COPY_LIMIT = 50;
export type ResourceCopyMetadata = {
  description: string;
  shortDescription: string;
  type: ProductType;
  tags: string[];
  compatibility: { mtaMinVersion?: string; dependencies: string[] };
};
export type ResourceCopyPreview = {
  source: {
    id: string;
    title: string;
    slug: string;
    status: string;
    updatedAt: Date;
    scope: "personal" | "organization";
  };
  metadata: ResourceCopyMetadata;
  reviewDigest: string;
};
export type ResourceCopyCommand = {
  requestId: string;
  reviewDigest: string;
  title: string;
  slug: string;
};
export type ResourceCopyReceipt = {
  id: string;
  createdAt: Date;
  source: { id: string; title: string };
  target: { id: string; title: string; slug: string; createdStatus: "draft" };
  metadata: ResourceCopyMetadata;
};
export type ResourceCopyDetail = { receipt: ResourceCopyReceipt; targetStatus: string };
