import { PRODUCT_TYPES, isProductType, type ProductType } from "@nexus/domain";

export const MARKET_PAGE_SIZE = 24;
export const MAX_MARKET_PAGE = 1000;
export const MARKET_TYPES = PRODUCT_TYPES;
export const MARKET_SORTS = ["popular", "newest", "rating"] as const;

export type MarketSort = (typeof MARKET_SORTS)[number];
export type MarketType = "all" | ProductType;
type Param = string | string[] | undefined;

export function parseMarketPage(value: Param): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,3}$/.test(value)) return 1;
  const page = Number(value);
  return page <= MAX_MARKET_PAGE ? page : 1;
}

export function parseMarketQuery(params: { type?: Param; sort?: Param; q?: Param; page?: Param }) {
  const type: MarketType = isProductType(params.type) ? params.type : "all";
  const sort: MarketSort =
    typeof params.sort === "string" && MARKET_SORTS.some((candidate) => candidate === params.sort)
      ? (params.sort as MarketSort)
      : "popular";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  return { type, sort, query, page: parseMarketPage(params.page) };
}

export function marketHref(filters: {
  type: MarketType;
  sort: MarketSort;
  query: string;
  page?: number;
}) {
  const params = new URLSearchParams({ type: filters.type, sort: filters.sort });
  if (filters.query) params.set("q", filters.query);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return `/market?${params.toString()}`;
}
