import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";
import type { ProductDependencyResolution } from "../lib/product-dependency-resolution";

export function ProductDependencyList({
  declared,
  resolution,
  locale = "en",
}: {
  declared: readonly string[];
  resolution: ProductDependencyResolution | null;
  locale?: Locale;
}) {
  const copy = getDictionary(locale).dependencyUi;

  if (declared.length === 0) {
    return <span className="font-mono text-secondary">{copy.noneDeclared}</span>;
  }

  if (!resolution) {
    return <ErrorState title={copy.resolutionUnavailable} />;
  }

  return (
    <div className="min-w-0 space-y-1.5 text-right">
      {resolution.dependencies.map((dependencyItem) =>
        dependencyItem.status === "available" && dependencyItem.product ? (
          <div key={dependencyItem.slug}>
            <Link
              href={`/market/${dependencyItem.product.slug}`}
              className="font-mono text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dependencyItem.product.slug}
            </Link>
            <span className="ml-1 text-[10px] text-faint">
              v{dependencyItem.product.currentVersion}
            </span>
          </div>
        ) : dependencyItem.status === "self_reference" ? (
          <div key={dependencyItem.slug}>
            <ErrorState title={copy.selfReference} description={dependencyItem.slug} />
          </div>
        ) : (
          <div key={dependencyItem.slug}>
            <ErrorState
              id="product-dependency-not-found"
              title={copy.notFound}
              description={dependencyItem.slug}
            />
          </div>
        ),
      )}
      <div className="pt-1 text-[10px] text-faint">{copy.resolutionNotice}</div>
    </div>
  );
}
