import type { Product } from "@nexus/domain";

const MAX_VISIBLE_REVERSE_DEPENDENCIES = 50;

export type ReverseDependencySummary = Readonly<{
  totalVisible: number;
  limitReached: boolean;
  products: readonly Readonly<{
    id: string;
    slug: string;
    title: string;
    type: Product["type"];
    currentVersion: string;
  }>[];
}>;

export function buildReverseDependencySummary(
  sourceProductSlug: string,
  dependents: readonly Pick<Product, "id" | "slug" | "title" | "type" | "currentVersion">[],
): ReverseDependencySummary {
  const normalizedSource = sourceProductSlug.trim().toLowerCase();
  const unique = new Map<
    string,
    Pick<Product, "id" | "slug" | "title" | "type" | "currentVersion">
  >();

  for (const product of dependents) {
    const slug = product.slug.trim().toLowerCase();
    if (!slug || slug === normalizedSource || unique.has(slug)) continue;
    unique.set(slug, product);
  }

  const all = Array.from(unique.values());
  const limitReached = all.length > MAX_VISIBLE_REVERSE_DEPENDENCIES;
  const visible = all.slice(0, MAX_VISIBLE_REVERSE_DEPENDENCIES);

  return Object.freeze({
    totalVisible: visible.length,
    limitReached,
    products: visible.map((product) =>
      Object.freeze({
        id: product.id,
        slug: product.slug,
        title: product.title,
        type: product.type,
        currentVersion: product.currentVersion,
      }),
    ),
  });
}

export const reverseDependencyLimits = Object.freeze({
  visible: MAX_VISIBLE_REVERSE_DEPENDENCIES,
  query: MAX_VISIBLE_REVERSE_DEPENDENCIES + 1,
});
