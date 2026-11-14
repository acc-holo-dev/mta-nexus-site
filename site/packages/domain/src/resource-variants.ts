import type { ProductStatus } from "./entities";

export const RESOURCE_VARIANT_LIMIT = 12;
export type ResourceVariant = {
  productId: string;
  label: string;
  title: string;
  slug: string;
  currentVersion: string;
};
export type PublicResourceVariants = { title: string; variants: ResourceVariant[] };
export type ManagedResourceVariants = {
  anchorProductId: string;
  group: null | {
    id: string;
    revision: number;
    title: string;
    variants: (ResourceVariant & { status: ProductStatus })[];
  };
};
export type ResourceVariantCommand =
  | {
      action: "save";
      expectedGroupId: string | null;
      expectedRevision: number;
      title: string;
      variants: { productId: string; label: string }[];
      reason: string;
    }
  | { action: "remove"; expectedGroupId: string; expectedRevision: number; reason: string };

/** Variants share a publisher, never an entitlement, license or release. */
export function sameResourcePublisher(
  left: { authorId: string; organizationId: string | null },
  right: { authorId: string; organizationId: string | null },
): boolean {
  return left.organizationId !== null
    ? left.organizationId === right.organizationId
    : right.organizationId === null && left.authorId === right.authorId;
}
