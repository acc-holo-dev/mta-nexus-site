import { PRODUCT_TYPES, type ProductType } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { ChevronLeft, ChevronRight, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "../view";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { MARKET_PAGE_SIZE, MAX_MARKET_PAGE, marketHref, parseMarketQuery } from "../model";
import { PRODUCT_CATEGORY_KEYS } from "../../../lib/product-type-labels";
import { productService } from "../../../lib/services/product-service";

const CATEGORIES = [
  { id: "all", key: "all" },
  ...PRODUCT_TYPES.map((id) => ({ id, key: PRODUCT_CATEGORY_KEYS[id] })),
] as const;

const SORTS = [
  { id: "popular", key: "popular" },
  { id: "newest", key: "newest" },
  { id: "rating", key: "rating" },
] as const;

const actionLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function MarketPage({
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
  const buildHref = (
    nextType: typeof type,
    nextSort: typeof sort,
    nextQuery = query,
    nextPage = 1,
  ) => marketHref({ type: nextType, sort: nextSort, query: nextQuery, page: nextPage });
  const catalogHref = buildHref(type, sort, query, page);

  let catalog: {
    products: Awaited<ReturnType<typeof productService.listPublicPage>>["products"];
    hasMore: boolean;
    attributions: Awaited<ReturnType<typeof productService.getPublicAttributions>>;
  } | null = null;
  try {
    const { products, hasMore } = await productService.listPublicPage({
      type: type === "all" ? undefined : type,
      sort,
      query,
      page,
      pageSize: MARKET_PAGE_SIZE,
    });
    const attributions = await productService.getPublicAttributions(products);
    catalog = { products, hasMore, attributions };
  } catch {
    catalog = null;
  }

  const filtersActive = type !== "all" || sort !== "popular" || Boolean(query) || page > 1;
  const activeCategoryLabel =
    type !== "all"
      ? `${dictionary.market.categoryLabel}: ${dictionary.market[PRODUCT_CATEGORY_KEYS[type as ProductType]]}`
      : null;
  const activeSortOption = SORTS.find((option) => option.id === sort);
  const activeSortLabel =
    sort !== "popular" && activeSortOption
      ? `${dictionary.market.sortLabel}: ${dictionary.market[activeSortOption.key]}`
      : null;
  const activeQueryLabel = query ? `${dictionary.market.searchLabel}: ${query}` : null;

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      <div className="flex min-w-0 flex-col justify-between gap-3 pb-1 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className="flex min-w-0 items-center gap-2.5 font-display text-primary">
            <ShoppingBag className="h-6 w-6 shrink-0 text-accent" />
            <span className="min-w-0 break-words">{dictionary.market.title}</span>
          </h1>
          <p className="mt-0.5 font-caption text-muted">
            {dictionary.market.showing} {catalog?.products.length ?? "—"}
          </p>
        </div>
      </div>

      <search aria-label={dictionary.market.searchLabel}>
        <form action="/market" method="get" className="flex flex-wrap gap-2">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="sort" value={sort} />
          <label htmlFor="market-query" className="sr-only">
            {dictionary.market.searchLabel}
          </label>
          <input
            id="market-query"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query}
            placeholder={dictionary.market.searchPlaceholder}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-base bg-surface px-3 text-sm text-primary placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <Button type="submit" className="min-h-11 gap-2 font-semibold">
            <Search className="h-4 w-4" aria-hidden="true" />
            {dictionary.market.searchButton}
          </Button>
          {query ? (
            <Link href={buildHref(type, sort, "")} className={actionLinkClass}>
              {dictionary.market.clearQuery}
            </Link>
          ) : null}
        </form>
      </search>

      <nav
        aria-label={dictionary.market.sortLabel}
        className="flex items-center gap-1 overflow-x-auto border-b border-base"
      >
        {SORTS.map((option) => {
          const isActive = option.id === sort;
          return (
            <Link
              key={option.id}
              href={buildHref(type, option.id, query)}
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

      <nav
        aria-label={dictionary.market.categoryLabel}
        className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1"
      >
        {CATEGORIES.map((category) => {
          const isActive = type === category.id;
          return (
            <Link
              key={category.id}
              href={buildHref(category.id, sort, query)}
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

      {!catalog ? (
        <ErrorState
          title={dictionary.market.loadUnavailable}
          action={
            <Link href={catalogHref} className={actionLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : catalog.products.length > 0 ? (
        <div className="grid min-w-0 grid-cols-1 gap-5 overflow-x-clip sm:grid-cols-2 lg:grid-cols-4">
          {catalog.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              attribution={catalog.attributions.get(product.id) ?? null}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            page > 1
              ? dictionary.market.endOfResults
              : filtersActive
                ? dictionary.market.emptyFiltered
                : dictionary.market.empty
          }
          description={
            page > 1
              ? dictionary.market.endOfResultsHint
              : filtersActive
                ? dictionary.market.emptyFilteredHint
                : dictionary.market.emptyHint
          }
          action={
            <div className="mx-auto max-w-lg space-y-4">
              {filtersActive ? (
                <div className="space-y-2 text-left text-sm text-secondary">
                  <p className="font-semibold text-primary">{dictionary.market.activeFilters}</p>
                  <ul className="list-inside list-disc space-y-1">
                    {activeCategoryLabel ? <li>{activeCategoryLabel}</li> : null}
                    {activeSortLabel ? <li>{activeSortLabel}</li> : null}
                    {activeQueryLabel ? <li>{activeQueryLabel}</li> : null}
                    {page > 1 ? (
                      <li>
                        {dictionary.market.pageLabel} {page}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {page > 1 ? (
                  <Link
                    href={buildHref(type, sort, query)}
                    className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {dictionary.market.firstPageSameFilters}
                  </Link>
                ) : null}
                {query ? (
                  <Link href={buildHref(type, sort, "")} className={actionLinkClass}>
                    {dictionary.market.clearQuery}
                  </Link>
                ) : null}
                {type !== "all" ? (
                  <Link href={buildHref("all", sort, query)} className={actionLinkClass}>
                    {dictionary.market.clearCategory}
                  </Link>
                ) : null}
                <Link href="/market" className={actionLinkClass}>
                  {dictionary.market.clear}
                </Link>
              </div>
            </div>
          }
        />
      )}

      {catalog && (page > 1 || catalog.hasMore) && (
        <nav
          aria-label={dictionary.market.paginationLabel}
          className="flex items-center justify-between gap-4 border-t border-base pt-4"
        >
          {page > 1 ? (
            <Link
              href={buildHref(type, sort, query, page - 1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-base px-4 text-sm font-semibold text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {dictionary.market.previousPage}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">
            {dictionary.market.pageLabel} {page}
          </span>
          {catalog.hasMore && page < MAX_MARKET_PAGE ? (
            <Link
              href={buildHref(type, sort, query, page + 1)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-base px-4 text-sm font-semibold text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-accent"
            >
              {dictionary.market.nextPage}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
