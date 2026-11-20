import type { ReactNode } from "react";
import { pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W64, skelH28 } from "../../shell/skeleton-shell";
import { subscriptionsCopy } from "../subscriptions-i18n";

type Copy = ReturnType<typeof subscriptionsCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function SubscriptionsRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax5xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 3,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey?: StringKey;
  loadingKey?: StringKey;
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
    throw new Error("SubscriptionsRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className={skelH10W64} /> : (leading ?? undefined);
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
      const copy = subscriptionsCopy(typedLocale);
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

export function SubscriptionsActivateRouteLoading() {
  return SubscriptionsRouteLoading({
    headingId: "subscriptions-activate-loading-heading",
    rows: 0,
    leading: (
      <>
        <div className={skelH10W64} />
        <div className={skelH28} />
      </>
    ),
    titleKey: "activate",
  });
}

export function SubscriptionsHistoryRouteLoading() {
  return SubscriptionsRouteLoading({
    headingId: "subscriptions-history-loading-heading",
    rows: 4,
    titleKey: "history",
  });
}

export function CommerceSubscriptionsRouteLoading() {
  return SubscriptionsRouteLoading({
    headingId: "subscriptions-loading-heading",
    leading: (
      <>
        <div className={skelH10W64} />
        <div className={skelH28} />
      </>
    ),
    titleKey: "title",
  });
}

export function SubscriptionReceiptRouteLoading() {
  return SubscriptionsRouteLoading({
    headingId: "subscription-receipt-loading-heading",
    titleKey: "recorded",
  });
}
