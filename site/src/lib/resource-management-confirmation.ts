import type { Product, ResourceVariantCommand } from "@nexus/domain";

export function confirmedVariantCommand(
  body: unknown,
  productId: string,
  command: ResourceVariantCommand,
): boolean {
  if (!body || typeof body !== "object") return false;
  const result = body as Record<string, unknown>;
  if (result.productId !== productId) return false;
  if (command.action === "remove") return result.groupId === null && result.revision === 0;
  return (
    typeof result.groupId === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/u.test(result.groupId) &&
    (command.expectedGroupId === null || result.groupId === command.expectedGroupId) &&
    result.revision === command.expectedRevision + 1
  );
}
export function confirmedCompatibility(
  body: unknown,
  productId: string,
  expectedUpdatedAt: string,
  compatibility: Product["compatibility"],
): boolean {
  if (!body || typeof body !== "object") return false;
  const product = (body as { product?: Record<string, unknown> }).product;
  if (
    !product ||
    product.id !== productId ||
    typeof product.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(product.updatedAt)) ||
    new Date(product.updatedAt).toISOString() !== product.updatedAt ||
    Date.parse(product.updatedAt) <= Date.parse(expectedUpdatedAt)
  )
    return false;
  const saved = product.compatibility as Product["compatibility"] | null;
  return (
    !!saved &&
    saved.mtaMinVersion === compatibility.mtaMinVersion &&
    Array.isArray(saved.dependencies) &&
    saved.dependencies.length === compatibility.dependencies?.length &&
    saved.dependencies.every((slug, index) => slug === compatibility.dependencies?.[index])
  );
}
