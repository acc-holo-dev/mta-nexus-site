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

/** Allowed author lifecycle actions for the current resource status. */
export function resourceLifecycleActionsFor(status: ProductStatus): ResourceLifecycleAction[] {
  return RESOURCE_LIFECYCLE_ACTIONS.filter((action) => canTransitionResource(status, action));
}

/**
 * Target status after a successful author command. Restore/archive never imply
 * automatic return to the public catalog.
 */
export function resourceLifecycleTarget(
  status: ProductStatus,
  action: ResourceLifecycleAction,
): ProductStatus | null {
  if (!canTransitionResource(status, action)) return null;
  if (action === "archive") return "archived";
  if (action === "restore") return "draft";
  return "pending_review";
}

export type ResourceLifecycleNextStep =
  | "archive"
  | "restore"
  | "submit"
  | "wait_review"
  | "suspended_support"
  | "none";

export function resourceLifecycleNextStep(status: ProductStatus): ResourceLifecycleNextStep {
  if (status === "suspended") return "suspended_support";
  if (status === "archived") return "restore";
  if (status === "draft") return "submit";
  if (status === "pending_review") return "wait_review";
  if (status === "published") return "archive";
  return "none";
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
  requestId?: string;
};
