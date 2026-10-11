import { AppError } from "@nexus/domain";

const invalid = () => new AppError("Invalid resource copy request", 400, "RESOURCE_COPY_INVALID");
export function resourceCopyId(value: string) {
  if (value.trim() !== value || !/^[A-Za-z0-9_-]{1,160}$/u.test(value)) throw invalid();
  return value;
}
export function resourceCopiesQuery(params: URLSearchParams, history = false) {
  for (const key of params.keys())
    if (!history || !["page", "days"].includes(key) || params.getAll(key).length !== 1)
      throw invalid();
  const page = params.get("page") ?? "1",
    days = params.get("days") ?? "all";
  if (!/^[1-9][0-9]{0,3}$/u.test(page) || !["all", "7", "30", "90", "365"].includes(days))
    throw invalid();
  return {
    page: Number(page),
    days: days === "all" ? ("all" as const) : (Number(days) as 7 | 30 | 90 | 365),
  };
}
export function resourceCopiesPageParams(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) throw invalid();
    params.set(key, value);
  }
  return params;
}
