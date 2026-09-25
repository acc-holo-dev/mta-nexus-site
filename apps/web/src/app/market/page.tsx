import Link from "next/link";
import { productService } from "../../lib/services/product-service";
import { ProductCard } from "../../components/product-card";
import { ShoppingBag } from "lucide-react";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { id: "all", key: "all" },
  { id: "script", key: "scripts" },
  { id: "vehicle", key: "vehicles" },
  { id: "model", key: "models" },
  { id: "map", key: "maps" },
  { id: "ui", key: "ui" },
  { id: "plugin", key: "plugins" },
  { id: "bundle", key: "bundles" },
  { id: "service", key: "services" },
] as const;

const SORTS = [
  { id: "popular", key: "popular" },
  { id: "newest", key: "newest" },
  { id: "rating", key: "rating" },
] as const;

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; q?: string }>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
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
    `/market?type=${type}&sort=${sort}${query ? `&q=${encodeURIComponent(query)}` : ""}`;

  const countLabel =
    products.length === 1
      ? dictionary.market.readySingle
      : dictionary.market.ready;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 pb-1 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-primary">
            <ShoppingBag className="h-6 w-6 text-accent" />
            <span>{dictionary.market.title}</span>
          </h1>
          <p className="mt-0.5 font-caption text-muted">
            {products.length} {countLabel}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-base">
        {SORTS.map((sort) => {
          const isActive = activeSort === sort.id;
          return (
            <Link
              key={sort.id}
              href={buildHref(activeType, sort.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-primary"
              }`}
            >
              {dictionary.market[sort.key]}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((category) => {
          const isActive = activeType === category.id;
          return (
            <Link
              key={category.id}
              href={buildHref(category.id, activeSort)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-accent font-semibold text-white"
                  : "border border-base bg-surface text-secondary hover:border-strong hover:text-primary"
              }`}
            >
              {dictionary.market[category.key]}
            </Link>
          );
        })}
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="nexus-panel py-16 text-center">
          <p className="font-caption text-muted">{dictionary.market.empty}</p>
          <Link
            href="/market"
            className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
          >
            {dictionary.market.clear}
          </Link>
        </div>
      )}
    </div>
  );
}
