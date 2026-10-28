import type { Entitlement, License } from "@nexus/domain";

export type LibraryEntry = { resourceId: string; createdAt: Date };

export function collectLibraryEntries(
  entitlements: readonly Pick<Entitlement, "resourceId" | "permission" | "createdAt">[],
  legacyLicenses: readonly Pick<License, "productId" | "createdAt">[],
): LibraryEntry[] {
  const byResource = new Map<string, LibraryEntry>();
  const add = (resourceId: string, createdAt: Date) => {
    const current = byResource.get(resourceId);
    if (!current || current.createdAt < createdAt) {
      byResource.set(resourceId, { resourceId, createdAt });
    }
  };

  for (const entitlement of entitlements) {
    if (entitlement.permission === "product.download") {
      add(entitlement.resourceId, entitlement.createdAt);
    }
  }
  for (const license of legacyLicenses) add(license.productId, license.createdAt);

  return [...byResource.values()].sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() || a.resourceId.localeCompare(b.resourceId),
  );
}
