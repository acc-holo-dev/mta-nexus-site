import Link from "next/link";
import { productService } from "../../lib/services/product-service";
import { ProductCard } from "../../components/product-card";
import { SectionHeader } from "@nexus/ui";
import { ShoppingBag } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "script", label: "Scripts" },
  { id: "vehicle", label: "Vehicles" },
  { id: "model", label: "Models" },
  { id: "map", label: "Maps" },
  { id: "ui", label: "UI" },
  { id: "plugin", label: "Plugins" },
  { id: "bundle", label: "Bundles" },
  { id: "service", label: "Services" },
];

const SORTS = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "New" },
  { id: "rating", label: "Top Rated" },
  { id: "price_asc", label: "Price ↑" },
  { id: "price_desc", label: "Price ↓" },
];

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; q?: string }>;
}) {
  const params = await searchParams;
  const activeType = params.type || "all";
  const activeSort = params.sort || "popular";
  const query = params.q || "";

  const products = await productService.listProducts({
    type: activeType === "all" ? undefined : (activeType as any),
    sort: activeSort as any,
    query,
    maxPrice: 0,
  });

  const buildHref = (type: string, sort: string) =>
    `/market?type=${type}&sort=${sort}${query ? `&q=${query}` : ""}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="font-display text-primary flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-accent" />
            <span>Free Resource Library</span>
          </h1>
          <p className="font-caption text-muted mt-0.5">
            {products.length} free resource{products.length === 1 ? "" : "s"} ready for your library
          </p>
        </div>
      </div>

      {/* Sort tabs */}
      <div className="flex items-center gap-1 border-b border-base overflow-x-auto">
        {SORTS.map((s) => {
          const isActive = activeSort === s.id;
          return (
            <Link
              key={s.id}
              href={buildHref(activeType, s.id)}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-primary"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORIES.map((c) => {
          const isActive = activeType === c.id;
          return (
            <Link
              key={c.id}
              href={buildHref(c.id, activeSort)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white font-semibold"
                  : "bg-surface border border-base text-secondary hover:text-primary hover:border-strong"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {/* Product grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center nexus-panel">
          <p className="font-caption text-muted">No resources found in this category.</p>
          <Link
            href="/market"
            className="inline-block mt-3 px-4 py-2 rounded-md bg-accent hover:bg-[var(--nexus-accent-hover)] text-white text-xs font-semibold transition-colors"
          >
            Clear Filters
          </Link>
        </div>
      )}
    </div>
  );
}
