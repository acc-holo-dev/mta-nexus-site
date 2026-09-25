import Link from "next/link";
import type { ProductDependencyResolution } from "../lib/product-dependency-resolution";

export function ProductDependencyList({
  declared,
  resolution,
}: {
  declared: readonly string[];
  resolution: ProductDependencyResolution | null;
}) {
  if (declared.length === 0) {
    return <span className="font-mono text-neutral-200">None declared</span>;
  }

  if (!resolution) {
    return (
      <div className="space-y-1 text-right">
        <div className="font-mono text-neutral-300">
          {declared.join(", ")}
        </div>
        <div className="text-[10px] text-amber-300">
          Catalogue resolution temporarily unavailable
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1.5 text-right">
      {resolution.dependencies.map((dependency) =>
        dependency.status === "available" && dependency.product ? (
          <div key={dependency.slug}>
            <Link
              href={`/market/${dependency.product.slug}`}
              className="font-mono text-blue-300 hover:underline"
            >
              {dependency.product.slug}
            </Link>
            <span className="ml-1 text-[10px] text-neutral-500">
              v{dependency.product.currentVersion}
            </span>
          </div>
        ) : dependency.status === "self_reference" ? (
          <div key={dependency.slug}>
            <span className="font-mono text-amber-300">{dependency.slug}</span>
            <span className="ml-1 text-[10px] text-amber-400">
              self reference
            </span>
          </div>
        ) : (
          <div key={dependency.slug}>
            <span className="font-mono text-neutral-300">{dependency.slug}</span>
            <span className="ml-1 text-[10px] text-neutral-500">
              not found in public NEXUS catalogue
            </span>
          </div>
        ),
      )}
      <div className="pt-1 text-[10px] text-neutral-500">
        Resolution checks public catalogue presence only; it is not a
        compatibility guarantee.
      </div>
    </div>
  );
}
