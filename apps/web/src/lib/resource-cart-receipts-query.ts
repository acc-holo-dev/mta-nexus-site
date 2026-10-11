import { AppError, type ResourceCartReceiptQuery } from "@nexus/domain";
const invalid = () => new AppError("Invalid receipt query", 400, "RESOURCE_CART_RECEIPT_INVALID");
export function resourceCartReceiptId(value: string) {
  // Receipts created by the former API already used UUID request keys.
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value))
    throw invalid();
  return value;
}
export function resourceCartReceiptQuery(params: URLSearchParams): ResourceCartReceiptQuery {
  for (const key of params.keys())
    if (!["page", "days", "evidence"].includes(key) || params.getAll(key).length !== 1)
      throw invalid();
  const page = params.get("page") ?? "1",
    days = params.get("days") ?? "all",
    evidence = params.get("evidence") ?? "all";
  if (
    !/^[1-9][0-9]{0,3}$/u.test(page) ||
    !["all", "7", "30", "90", "365"].includes(days) ||
    !["all", "reviewed", "legacy"].includes(evidence)
  )
    throw invalid();
  return {
    page: Number(page),
    days: days === "all" ? "all" : (Number(days) as 7 | 30 | 90 | 365),
    evidence: evidence as ResourceCartReceiptQuery["evidence"],
  };
}
export function resourceCartReceiptsUrl(query: ResourceCartReceiptQuery, api = false) {
  return `${api ? "/api/resources/cart/receipts" : "/workspace/acquisitions/receipts"}?${new URLSearchParams({ page: String(query.page), days: String(query.days), evidence: query.evidence })}`;
}
export function resourceCartReceiptUrl(requestId: string) {
  return `/workspace/acquisitions/receipts/${encodeURIComponent(requestId)}`;
}
