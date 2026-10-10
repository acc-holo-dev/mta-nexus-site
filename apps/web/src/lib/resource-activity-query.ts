import { AppError, RESOURCE_ACTIVITY_DAYS, type ResourceActivityDays } from "@nexus/domain";

function invalid(): never {
  throw new AppError("Invalid resource activity query", 400, "RESOURCE_ACTIVITY_INVALID");
}

export function parseResourceActivityQuery(query: URLSearchParams): ResourceActivityDays {
  if ([...query.keys()].some((key) => key !== "days") || query.getAll("days").length > 1) invalid();
  const value = query.get("days");
  if (value === null) return 30;
  return RESOURCE_ACTIVITY_DAYS.find((days) => String(days) === value) ?? invalid();
}

export function parseAcquisitionHistoryQuery(query: URLSearchParams): {
  page: number;
  source: "all" | "direct" | "cart";
} {
  if (
    [...query.keys()].some((key) => key !== "page" && key !== "source") ||
    query.getAll("page").length > 1 ||
    query.getAll("source").length > 1
  )
    invalid();
  const rawPage = query.get("page") ?? "1";
  if (!/^[1-9]\d{0,5}$/u.test(rawPage)) invalid();
  const source = query.get("source") ?? "all";
  if (source !== "all" && source !== "direct" && source !== "cart") invalid();
  return { page: Number(rawPage), source };
}
