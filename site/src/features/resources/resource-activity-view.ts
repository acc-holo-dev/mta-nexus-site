import { RESOURCE_ACTIVITY_DAYS, type ResourceActivityDays } from "@nexus/domain";

export function resourceActivityDays(value: string | string[] | undefined): ResourceActivityDays {
  return typeof value === "string"
    ? (RESOURCE_ACTIVITY_DAYS.find((day) => String(day) === value) ?? 30)
    : 30;
}
export function acquisitionSource(value: string | string[] | undefined): "all" | "direct" | "cart" {
  return value === "direct" || value === "cart" ? value : "all";
}
export function acquisitionPage(value: string | string[] | undefined): number {
  return typeof value === "string" && /^[1-9]\d{0,5}$/u.test(value) ? Number(value) : 1;
}
export function acquisitionHistoryHref(source: "all" | "direct" | "cart", page: number): string {
  return `/workspace/acquisitions?${new URLSearchParams({ source, page: String(page) })}`;
}
