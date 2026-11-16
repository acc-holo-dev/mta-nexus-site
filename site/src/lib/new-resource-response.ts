import { createProductSchema } from "@nexus/validation";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sameList(value: unknown, expected: string[]) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index])
  );
}

/** Confirm the created draft belongs to this actor and this submitted form. */
export function confirmedCreatedResource(
  status: number,
  body: unknown,
  actorId: string,
  request: unknown,
): { id: string; slug: string } | null {
  if (
    !record(body) ||
    !record(body.product) ||
    (status !== 201 && !(status === 200 && body.reusedDraft === true))
  )
    return null;
  const parsed = createProductSchema.safeParse(request);
  if (!parsed.success) return null;
  const input = parsed.data;
  const product = body.product;
  if (
    typeof product.id !== "string" ||
    product.id.trim().length < 3 ||
    product.id.length > 128 ||
    product.authorId !== actorId ||
    product.status !== "draft" ||
    product.slug !== input.slug ||
    product.title !== input.title ||
    product.description !== input.description ||
    (product.shortDescription ?? "") !== (input.shortDescription ?? "") ||
    product.type !== input.type ||
    product.price !== input.price ||
    product.currency !== input.currency ||
    product.licenseModel !== input.licenseModel ||
    (product.organizationId ?? undefined) !== input.organizationId ||
    !sameList(product.tags, input.tags) ||
    !record(product.compatibility) ||
    product.compatibility.mtaMinVersion !== input.compatibility.mtaMinVersion ||
    !sameList(product.compatibility.dependencies, input.compatibility.dependencies)
  )
    return null;
  return { id: product.id, slug: input.slug };
}
