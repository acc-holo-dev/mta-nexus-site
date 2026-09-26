import Link from "next/link";
import type { ProductDependencyResolution } from "../lib/product-dependency-resolution";
import { getDictionary, type Locale } from "../lib/i18n";

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
    return (
      <div className="space-y-1 text-right">
        <div className="font-mono text-secondary">
          {declared.join(", ")}
        </div>
        <div className="text-[10px] text-warning">
          {copy.resolutionUnavailable}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1.5 text-right">
      {resolution.dependencies.map((dependencyItem) =>
        dependencyItem.status === "available" && dependencyItem.product ? (
          <div key={dependencyItem.slug}>
            <Link
              href={`/market/${dependencyItem.product.slug}`}
              className="font-mono text-accent hover:underline"
            >
              {dependencyItem.product.slug}
            </Link>
            <span className="ml-1 text-[10px] text-faint">
              v{dependencyItem.product.currentVersion}
            </span>
          </div>
        ) : dependencyItem.status === "self_reference" ? (
          <div key={dependencyItem.slug}>
            <span className="font-mono text-warning">
              {dependencyItem.slug}
            </span>
            <span className="ml-1 text-[10px] text-warning">
              {copy.selfReference}
            </span>
          </div>
        ) : (
          <div key={dependencyItem.slug}>
            <span className="font-mono text-secondary">
              {dependencyItem.slug}
            </span>
            <span className="ml-1 text-[10px] text-faint">
              {copy.notFound}
            </span>
          </div>
        ),
      )}
      <div className="pt-1 text-[10px] text-faint">
        {copy.resolutionNotice}
      </div>
    </div>
  );
}
