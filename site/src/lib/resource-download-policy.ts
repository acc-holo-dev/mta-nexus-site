import type { Product } from "@nexus/domain";

export type ResourceDownloadDecision =
  | Readonly<{ allowed: true; reason: "manager" | "entitlement" }>
  | Readonly<{
      allowed: false;
      reason: "resource_not_published" | "entitlement_required";
    }>;

export function decideResourceDownloadAccess(
  product: Pick<Product, "status">,
  hasManagementAccess: boolean,
  hasEntitlement: boolean,
): ResourceDownloadDecision {
  if (product.status !== "published") {
    return Object.freeze({
      allowed: false,
      reason: "resource_not_published",
    });
  }

  if (hasManagementAccess) {
    return Object.freeze({ allowed: true, reason: "manager" });
  }

  if (hasEntitlement) {
    return Object.freeze({ allowed: true, reason: "entitlement" });
  }

  return Object.freeze({
    allowed: false,
    reason: "entitlement_required",
  });
}
