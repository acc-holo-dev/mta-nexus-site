import { AppError, SELLER_SALES_EVIDENCE, type SellerSalesQuery } from "@nexus/domain";

const invalid = () => new AppError("Invalid sales query", 400, "SELLER_SALES_INVALID");
export function sellerSalesId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(value) || value.trim() !== value) throw invalid();
  return value;
}
export function sellerSalesQuery(params: URLSearchParams): SellerSalesQuery {
  for (const key of params.keys())
    if (
      !["page", "days", "status", "evidence", "currency", "organizationId", "productId"].includes(
        key,
      ) ||
      params.getAll(key).length !== 1
    )
      throw invalid();
  const page = params.get("page") ?? "1",
    days = params.get("days") ?? "all",
    status = params.get("status") ?? "completed",
    evidence = params.get("evidence") ?? "all";
  if (
    !/^[1-9][0-9]{0,3}$/u.test(page) ||
    !["all", "7", "30", "90", "365"].includes(days) ||
    !["all", "completed", "refunded"].includes(status) ||
    !["all", ...SELLER_SALES_EVIDENCE].includes(evidence)
  )
    throw invalid();
  const currency = params.get("currency"),
    organizationId = params.get("organizationId"),
    productId = params.get("productId");
  if (currency !== null && !["USD", "EUR", "RUB"].includes(currency)) throw invalid();
  return {
    page: Number(page),
    days: days === "all" ? "all" : (Number(days) as SellerSalesQuery["days"]),
    status: status as SellerSalesQuery["status"],
    evidence: evidence as SellerSalesQuery["evidence"],
    ...(currency ? { currency: currency as SellerSalesQuery["currency"] } : {}),
    ...(organizationId !== null ? { organizationId: sellerSalesId(organizationId) } : {}),
    ...(productId !== null ? { productId: sellerSalesId(productId) } : {}),
  };
}
export function sellerSalesPageQuery(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) throw invalid();
    params.append(key, value);
  }
  const scopePage = params.get("scopePage") ?? "1";
  if (!/^[1-9][0-9]{0,3}$/u.test(scopePage) || params.getAll("scopePage").length > 1)
    throw invalid();
  params.delete("scopePage");
  return { query: sellerSalesQuery(params), scopePage: Number(scopePage) };
}
export function sellerSalesUrl(query: SellerSalesQuery, page = query.page, scopePage?: number) {
  const params = new URLSearchParams({
    page: String(page),
    days: String(query.days),
    status: query.status,
    evidence: query.evidence,
  });
  for (const key of ["currency", "organizationId", "productId"] as const)
    if (query[key]) params.set(key, query[key]);
  if (scopePage !== undefined) params.set("scopePage", String(scopePage));
  return `/workspace/sales/report?${params}`;
}
export function sellerSaleUrl(id: string, organizationId?: string) {
  return `/workspace/sales/report/${encodeURIComponent(id)}${organizationId ? `?${new URLSearchParams({ organizationId })}` : ""}`;
}
