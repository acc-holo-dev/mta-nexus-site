import type { LibraryReleaseCommand, ResourceModerationCommand } from "@nexus/domain";
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function confirmedLibraryRelease(
  value: unknown,
  productId: string,
  command: LibraryReleaseCommand,
) {
  if (!record(value) || value.productId !== productId || !record(value.selection)) return false;
  const selection = value.selection;
  return (
    (selection.revision === command.expectedRevision ||
      selection.revision === command.expectedRevision + 1) &&
    selection.mode === command.mode &&
    selection.buildId === (command.mode === "fixed" ? command.buildId : null)
  );
}
export function confirmedResourceModeration(
  value: unknown,
  productId: string,
  command: ResourceModerationCommand,
) {
  if (!record(value) || !record(value.product)) return false;
  const product = value.product;
  return (
    product.id === productId &&
    product.status === (command.action === "suspend" ? "suspended" : "draft") &&
    typeof product.updatedAt === "string" &&
    Number.isFinite(Date.parse(product.updatedAt)) &&
    new Date(product.updatedAt).toISOString() === product.updatedAt &&
    Date.parse(product.updatedAt) > Date.parse(command.expectedUpdatedAt)
  );
}
