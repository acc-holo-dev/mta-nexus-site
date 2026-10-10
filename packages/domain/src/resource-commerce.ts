import type { ProductStatus } from "./entities";
import type { Entitlement } from "./entities";

/** An existing license is access, never a newly issued permanent grant. */
export type FreeResourceClaimResult =
  | { entitlement: Entitlement; alreadyClaimed: boolean; accessSource: "entitlement" }
  | {
      entitlement: null;
      alreadyClaimed: true;
      accessSource: "license";
      license: { productId: string; expiresAt: Date | null };
    };

export const RESOURCE_ACTIVITY_DAYS = [7, 30, 90, 365] as const;
export type ResourceActivityDays = (typeof RESOURCE_ACTIVITY_DAYS)[number];
export type ResourceAcquisitionSource = "direct" | "cart";

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
