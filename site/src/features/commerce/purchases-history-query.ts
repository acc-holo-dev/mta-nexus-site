import { parseHistoryPage } from "./commerce-history-format";

export function purchasesListHref(base: string, page: number) {
  return page > 1 ? `${base}?page=${encodeURIComponent(String(page))}` : base;
}

export function purchasesDetailHref(base: string, orderId: string, listPage: number) {
  const suffix = listPage > 1 ? `?fromPage=${encodeURIComponent(String(listPage))}` : "";
  return `${base}/${encodeURIComponent(orderId)}${suffix}`;
}

export function purchasesListPageFromDetail(
  query: Record<string, string | string[] | undefined>,
): number {
  return parseHistoryPage(query.fromPage);
}
