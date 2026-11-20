import type { ReactNode } from "react";
import { pageShellMax4xl, pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { getCommerceHistoryCopy } from "../commerce-history-i18n";
import { getLicenseControlCopy } from "../license-control-i18n";
import { getLicenseMaintenanceCopy } from "../license-maintenance-i18n";
import { orderCaseCopy } from "../order-case-i18n";

type HistoryCopy = ReturnType<typeof getCommerceHistoryCopy>;
type HistoryStringKey = {
  [K in keyof HistoryCopy]-?: HistoryCopy[K] extends string ? K : never;
}[keyof HistoryCopy];

function CommerceHistoryRouteLoading({
  headingId,
  titleKey,
  title,
  className = pageShellMax5xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey?: HistoryStringKey;
  title?: (locale: "en" | "ru") => ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  /** Pass `null` to omit the default leading pulse block. */
  leading?: ReactNode | null;
}) {
  if (titleKey === undefined && title === undefined) {
    throw new Error("CommerceHistoryRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className="h-10 w-64 rounded bg-inset" /> : (leading ?? undefined);
  return LocaleCopyRouteLoading({
    headingId,
    className,
    ...(headerClassName !== undefined ? { headerClassName } : {}),
    ...(titleClassName !== undefined ? { titleClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    ...(resolvedLeading !== undefined ? { leading: resolvedLeading } : {}),
    load: (locale) => {
      const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
      const history = getCommerceHistoryCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? history[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("CommerceHistoryRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: history.loading,
      };
    },
  });
}

export function AdminOrderCaseDetailRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-order-case-detail-loading-heading",
    leading: <div className="h-28 rounded bg-inset" />,
    title: (locale) => orderCaseCopy(locale).title,
  });
}

export function AdminOrderCasesRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-order-cases-loading-heading",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    title: (locale) => orderCaseCopy(locale).queue,
  });
}

export function AdminLicenseHistoryRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-license-history-loading-heading",
    className: pageShellMax4xl,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    title: (locale) => getLicenseControlCopy(locale).fullHistory,
  });
}

export function AdminLicenseDetailRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-license-detail-loading-heading",
    leading: <div className="h-28 rounded bg-inset" />,
    title: (locale) => getLicenseControlCopy(locale).title,
  });
}

export function AdminLicensesRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-licenses-loading-heading",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    title: (locale) => getLicenseControlCopy(locale).title,
  });
}

export function AdminLicenseMaintenanceRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-license-maintenance-loading-heading",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    title: (locale) => getLicenseMaintenanceCopy(locale).maintenance,
  });
}

export function LicenseHistoryRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "license-history-loading-heading",
    className: pageShellMax4xl,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    title: (locale) => getLicenseControlCopy(locale).fullHistory,
  });
}

export function LicenseDetailRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "license-detail-loading-heading",
    className: pageShellMax4xl,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    title: (locale) => getLicenseControlCopy(locale).title,
  });
}

export function LicensesRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "licenses-loading-heading",
    titleKey: "licensesTitle",
  });
}

export function PurchaseDetailRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "purchase-detail-loading-heading",
    titleKey: "details",
  });
}

export function PurchasesRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "purchases-loading-heading",
    titleKey: "purchasesTitle",
  });
}

export function SalesRouteLoading() {
  return CommerceHistoryRouteLoading({
    headingId: "sales-loading-heading",
    titleKey: "salesTitle",
  });
}
