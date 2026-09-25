import type { Product } from "@nexus/domain";

export type ProductDependencyResolutionItem = Readonly<{
  slug: string;
  status: "available" | "unresolved" | "self_reference";
  product: Readonly<{
    id: string;
    slug: string;
    title: string;
    type: Product["type"];
    currentVersion: string;
  }> | null;
}>;

export type ProductDependencyResolution = Readonly<{
  declaredCount: number;
  availableCount: number;
  unresolvedCount: number;
  selfReferenceCount: number;
  dependencies: readonly ProductDependencyResolutionItem[];
}>;

export function normalizeDependencySlugs(
  values: readonly string[] | undefined,
): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 25);
}

export function buildProductDependencyResolution(
  product: Pick<Product, "slug" | "compatibility">,
  publishedProducts: readonly Pick<
    Product,
    "id" | "slug" | "title" | "type" | "currentVersion"
  >[],
): ProductDependencyResolution {
  const declared = normalizeDependencySlugs(
    product.compatibility.dependencies,
  );
  const publishedBySlug = new Map(
    publishedProducts.map((dependency) => [
      dependency.slug.toLowerCase(),
      dependency,
    ]),
  );

  const dependencies = declared.map((slug) => {
    if (slug === product.slug.toLowerCase()) {
      return Object.freeze({
        slug,
        status: "self_reference" as const,
        product: null,
      });
    }

    const dependency = publishedBySlug.get(slug);
    if (!dependency) {
      return Object.freeze({
        slug,
        status: "unresolved" as const,
        product: null,
      });
    }

    return Object.freeze({
      slug,
      status: "available" as const,
      product: Object.freeze({
        id: dependency.id,
        slug: dependency.slug,
        title: dependency.title,
        type: dependency.type,
        currentVersion: dependency.currentVersion,
      }),
    });
  });

  return Object.freeze({
    declaredCount: dependencies.length,
    availableCount: dependencies.filter(
      (item) => item.status === "available",
    ).length,
    unresolvedCount: dependencies.filter(
      (item) => item.status === "unresolved",
    ).length,
    selfReferenceCount: dependencies.filter(
      (item) => item.status === "self_reference",
    ).length,
    dependencies,
  });
}
