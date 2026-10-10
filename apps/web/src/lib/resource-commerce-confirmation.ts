import { RESOURCE_CART_LIMIT, type ResourceCart, type ResourceCartAcquisition } from "@nexus/domain";

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function confirmedResourceCart(value: unknown): ResourceCart | null {
  if (
    !record(value) ||
    value.limit !== RESOURCE_CART_LIMIT ||
    !Array.isArray(value.items) ||
    value.items.length > RESOURCE_CART_LIMIT
  )
    return null;
  const ids = new Set<string>();
  for (const item of value.items) {
    if (
      !record(item) ||
      typeof item.productId !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/u.test(item.productId) ||
      ids.has(item.productId) ||
      typeof item.available !== "boolean" ||
      typeof item.alreadyOwned !== "boolean"
    )
      return null;
    if (item.available) {
      if (
        typeof item.title !== "string" ||
        typeof item.slug !== "string" ||
        !/^[a-z0-9-]+$/u.test(item.slug) ||
        typeof item.version !== "string"
      )
        return null;
    } else if (item.title !== null || item.slug !== null || item.version !== null) return null;
    ids.add(item.productId);
  }
  return value as unknown as ResourceCart;
}

export function confirmedCartAcquisition(
  value: unknown,
  productIds: readonly string[],
): ResourceCartAcquisition | null {
  if (
    !record(value) ||
    value.kind !== "free_resource_acquisition" ||
    !Array.isArray(value.acquired) ||
    value.acquired.length !== productIds.length
  )
    return null;
  const ids = new Set(productIds);
  for (const item of value.acquired) {
    if (
      !record(item) ||
      typeof item.productId !== "string" ||
      typeof item.alreadyClaimed !== "boolean" ||
      !ids.delete(item.productId)
    )
      return null;
  }
  return ids.size === 0 ? (value as unknown as ResourceCartAcquisition) : null;
}
