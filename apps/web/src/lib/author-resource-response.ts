import { editProductDetailsSchema } from "@nexus/validation";

type ProductDetails = { title: string; shortDescription: string; description: string; tags: string[] };
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function confirmedAuthorDetails(
  status: number, body: unknown, productId: string, expected: ProductDetails,
): (ProductDetails & { updatedAt: string }) | null {
  if (status !== 200 || !record(body) || !record(body.product)) return null;
  const product = body.product;
  if (product.id !== productId || typeof product.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(product.updatedAt))) return null;
  const parsed = editProductDetailsSchema.safeParse({ title: product.title,
    shortDescription: product.shortDescription, description: product.description, tags: product.tags });
  if (!parsed.success) return null;
  const details = parsed.data;
  if (details.title !== expected.title || details.shortDescription !== expected.shortDescription ||
    details.description !== expected.description || details.tags.length !== expected.tags.length ||
    details.tags.some((tag, index) => tag !== expected.tags[index])) return null;
  return { ...details, updatedAt: product.updatedAt };
}

export function confirmedAuthorBuild(
  status: number, body: unknown, productId: string, version: string,
): boolean {
  if (status !== 201 || !record(body) || !record(body.build)) return false;
  const build = body.build;
  return typeof build.id === "string" && build.id.trim().length > 0 && build.id.length <= 128 &&
    build.productId === productId && build.version === version.trim().replace(/^v/, "") &&
    build.status === "pending_review";
}
export function confirmedRetiredBuild(
  status: number, body: unknown, productId: string, buildId: string,
): boolean {
  return status === 200 && record(body) && record(body.build) &&
    body.build.id === buildId && body.build.productId === productId && body.build.status === "retired";
}
