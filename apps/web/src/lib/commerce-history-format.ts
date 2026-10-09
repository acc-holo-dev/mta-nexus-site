import type { LicenseStatus, OrderStatus } from "@nexus/domain";

/** Never trust a query string to control SQL page size or large offsets. */
export function parseHistoryPage(value: string | string[] | undefined): number {
  return typeof value === "string" && /^[1-9][0-9]{0,5}$/u.test(value)
    ? Number(value)
    : 1;
}

/** Display the effective status without mutating a historical license row. */
export function effectiveLicenseStatus(
  status: string,
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): LicenseStatus | string {
  if (
    status === "active" &&
    expiresAt instanceof Date &&
    Number.isFinite(expiresAt.getTime()) &&
    expiresAt.getTime() <= now.getTime()
  ) return "expired";
  return status;
}

export function formatHistoryDate(value: Date, locale: "en" | "ru"): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
    timeZone: "UTC",
  }).format(value);
}

/** Amounts are stored in ISO currency minor units; invalid values fail closed. */
export function formatHistoryAmount(
  minorUnits: number,
  currency: string,
  locale: "en" | "ru",
): string {
  if (!Number.isSafeInteger(minorUnits) || !/^[A-Z]{3}$/u.test(currency)) {
    return "—";
  }
  try {
    const formatter = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
      style: "currency",
      currency,
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(minorUnits / 10 ** fractionDigits);
  } catch {
    return "—";
  }
}

export function orderStatusLabel(
  status: string,
  labels: Readonly<Record<OrderStatus, string>>,
): string {
  return Object.prototype.hasOwnProperty.call(labels, status)
    ? labels[status as OrderStatus]
    : status;
}

export function licenseStatusLabel(
  status: string,
  labels: Readonly<Record<LicenseStatus, string>>,
): string {
  return Object.prototype.hasOwnProperty.call(labels, status)
    ? labels[status as LicenseStatus]
    : status;
}
