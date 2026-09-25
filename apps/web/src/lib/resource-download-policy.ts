import type { Product, User } from "@nexus/domain";

export type ResourceDownloadDecision =
  | Readonly<{ allowed: true; reason: "author" | "admin" | "entitlement" }>
  | Readonly<{
      allowed: false;
      reason: "resource_not_published" | "entitlement_required";
    }>;

export function decideResourceDownloadAccess(
  user: Pick<User, "id" | "role">,
  product: Pick<Product, "authorId" | "status">,
  hasEntitlement: boolean,
): ResourceDownloadDecision {
  if (product.status !== "published") {
    return Object.freeze({
      allowed: false,
      reason: "resource_not_published",
    });
  }

  if (product.authorId === user.id) {
    return Object.freeze({ allowed: true, reason: "author" });
  }

  if (user.role === "admin") {
    return Object.freeze({ allowed: true, reason: "admin" });
  }

  if (hasEntitlement) {
    return Object.freeze({ allowed: true, reason: "entitlement" });
  }

  return Object.freeze({
    allowed: false,
    reason: "entitlement_required",
  });
}
