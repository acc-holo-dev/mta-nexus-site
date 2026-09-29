import { PRODUCT_TYPES } from "@nexus/domain";
import { PRODUCT_CATEGORY_KEYS } from "../../lib/product-type-labels";
import Link from "next/link";
import { productService } from "../../lib/services/product-service";
import { ProductCard } from "../../components/product-card";
import { ChevronLeft, ChevronRight, Search, ShoppingBag } from "lucide-react";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { MARKET_PAGE_SIZE, MAX_MARKET_PAGE, marketHref, parseMarketQuery } from "../../lib/market-query";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { id: "all", key: "all" },
  ...PRODUCT_TYPES.map((id) => ({ id, key: PRODUCT_CATEGORY_KEYS[id] })),
] as const;

const SORTS = [
  { id: "popular", key: "popular" },
  { id: "newest", key: "newest" },
  { id: "rating", key: "rating" },
] as const;

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string | string[];
    sort?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const { type, sort, query, page } = parseMarketQuery(await searchParams);
  const { products, hasMore } = await productService.listPublicPage({
    type: type === "all" ? undefined : type,
    sort,
    query,
    page,
    pageSize: MARKET_PAGE_SIZE,
  });

  const buildHref = (nextType: typeof type, nextSort: typeof sort, nextPage = 1) =>
    marketHref({ type: nextType, sort: nextSort, query, page: nextPage });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 pb-1 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-primary">
            <ShoppingBag className="h-6 w-6 text-accent" />
            <span>{dictionary.market.title}</span>
          </h1>
          <p className="mt-0.5 font-caption text-muted">
            {dictionary.market.showing} {products.length}
          </p>
        </div>
      </div>

      <search aria-label={dictionary.market.searchLabel}>
        <form action="/market" method="get" className="flex flex-wrap gap-2">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="sort" value={sort} />
          <label htmlFor="market-query" className="sr-only">{dictionary.market.searchLabel}</label>
          <input
            id="market-query"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query}
            placeholder={dictionary.market.searchPlaceholder}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-base bg-surface px-3 text-sm text-primary placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Search className="h-4 w-4" aria-hidden="true" />
            {dictionary.market.searchButton}
          </button>
        </form>
      </search>

      <nav aria-label={dictionary.market.sortLabel} className="flex items-center gap-1 overflow-x-auto border-b border-base">
        {SORTS.map((option) => {
          const isActive = option.id === sort;
          return (
            <Link
              key={option.id}
              href={buildHref(type, option.id)}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px min-h-11 whitespace-nowrap border-b-2 px-3.5 py-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-primary"
              }`}
            >
              {dictionary.market[option.key]}
            </Link>
          );
        })}
      </nav>

      <nav aria-label={dictionary.market.categoryLabel} className="flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((category) => {
          const isActive = type === category.id;
          return (
            <Link
              key={category.id}
              href={buildHref(category.id, sort)}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isActive
                  ? "bg-accent font-semibold text-white"
                  : "border border-base bg-surface text-secondary hover:border-strong hover:text-primary"
              }`}
            >
              {dictionary.market[category.key]}
            </Link>
          );
        })}
      </nav>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="nexus-panel py-16 text-center">
          <p className="font-caption text-muted">{page > 1 ? dictionary.market.endOfResults : dictionary.market.empty}</p>
          <Link
            href={page > 1 ? buildHref(type, sort) : "/market"}
            className="mt-3 inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
          >
            {dictionary.market.clear}
          </Link>
        </div>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label={dictionary.market.paginationLabel} className="flex items-center justify-between gap-4 border-t border-base pt-4">
          {page > 1 ? (
            <Link href={buildHref(type, sort, page - 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-base px-4 text-sm font-semibold text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-accent">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {dictionary.market.previousPage}
            </Link>
          ) : <span />}
          <span className="text-sm text-muted">{dictionary.market.pageLabel} {page}</span>
          {hasMore && page < MAX_MARKET_PAGE ? (
            <Link href={buildHref(type, sort, page + 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-base px-4 text-sm font-semibold text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-accent">
              {dictionary.market.nextPage}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
