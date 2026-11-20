import type { ReactNode } from "react";
import { pageShellMax4xl, pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { getCommercialCopy } from "../commercial-i18n";
import { subscriptionsCopy } from "../subscriptions-i18n";

type CommercialCopy = ReturnType<typeof getCommercialCopy>;
type CommercialStringKey = {
  [K in keyof CommercialCopy]-?: CommercialCopy[K] extends string ? K : never;
}[keyof CommercialCopy];

function CommercialRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax5xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey?: CommercialStringKey;
  loadingKey?: CommercialStringKey;
  title?: (locale: "en" | "ru") => ReactNode;
  loading?: (locale: "en" | "ru") => ReactNode;
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
    throw new Error("CommercialRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className="h-10 w-72 rounded bg-inset" /> : (leading ?? undefined);
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
      const copy = getCommercialCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("missing route loading title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function AdminPlanDetailRouteLoading() {
  return CommercialRouteLoading({
    headingId: "admin-plan-detail-loading-heading",
    className: pageShellMax4xl,
    titleKey: "admin",
  });
}

export function AdminPlansRouteLoading() {
  return CommercialRouteLoading({
    headingId: "admin-plans-loading-heading",
    titleKey: "admin",
  });
}

export function AdminPlanNewRouteLoading() {
  return CommercialRouteLoading({
    headingId: "admin-plan-new-loading-heading",
    className: pageShellMax4xl,
    titleKey: "newPlan",
  });
}

export function PurchaseOperationsRouteLoading() {
  return CommercialRouteLoading({
    headingId: "purchase-operations-loading-heading",
    titleKey: "paymentOperations",
  });
}

export function SubscriptionsCatalogRouteLoading() {
  return CommercialRouteLoading({
    headingId: "subscriptions-catalog-loading-heading",
    rowClassName: "h-28 rounded bg-inset",
    titleKey: "catalog",
    loading: (locale) => subscriptionsCopy(locale).loading,
  });
}
