import { AppError } from "@nexus/domain";

export function resourceQaQuery(params: URLSearchParams) {
  const raw = params.get("page");
  if (raw === null || raw === "") return { page: 1 };
  if (!/^[1-9]\d{0,5}$/u.test(raw)) throw new AppError("Invalid page", 400, "RESOURCE_QA_INVALID");
  return { page: Number(raw) };
}
