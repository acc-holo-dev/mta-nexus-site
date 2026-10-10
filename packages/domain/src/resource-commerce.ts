import type { ProductStatus } from "./entities";

export const RESOURCE_CART_LIMIT = 20;
export const RESOURCE_LIFECYCLE_ACTIONS = ["archive", "restore", "submit"] as const;
export type ResourceLifecycleAction = (typeof RESOURCE_LIFECYCLE_ACTIONS)[number];

export function canTransitionResource(
  status: ProductStatus,
  action: ResourceLifecycleAction,
): boolean {
  if (action === "archive")
    return status === "draft" || status === "pending_review" || status === "published";
  if (action === "restore") return status === "archived";
  return status === "draft";
}

export type ResourceCartItem = {
  productId: string;
  title: string | null;
  slug: string | null;
  version: string | null;
  available: boolean;
  alreadyOwned: boolean;
};

export type ResourceCart = { items: ResourceCartItem[]; limit: number };
export type ResourceCartAcquisition = {
  kind: "free_resource_acquisition";
  acquired: { productId: string; alreadyClaimed: boolean }[];
};
