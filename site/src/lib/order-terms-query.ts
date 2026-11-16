import { AppError } from "@nexus/domain";

const invalid = () => new AppError("Invalid order terms query", 400, "ORDER_TERMS_INVALID");
export function orderTermsId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/u.test(value) || value.trim() !== value) throw invalid();
  return value;
}
export function orderTermsPageQuery(params: URLSearchParams) {
  if ([...params.keys()].some((key) => key !== "page") || params.getAll("page").length > 1)
    throw invalid();
  const page = params.get("page") ?? "1";
  if (page.trim() !== page || !/^[1-9][0-9]{0,3}$/u.test(page)) throw invalid();
  return Number(page);
}
