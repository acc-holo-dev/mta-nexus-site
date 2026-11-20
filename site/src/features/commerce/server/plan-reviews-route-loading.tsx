import type { ReactNode } from "react";
import { pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W64, skelH28 } from "../../shell/skeleton-shell";
import { planReviewsCopy } from "../plan-reviews-i18n";

type Copy = ReturnType<typeof planReviewsCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function PlanReviewsRouteLoading({
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
    throw new Error("PlanReviewsRouteLoading requires titleKey or title");
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
      const copy = planReviewsCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("PlanReviewsRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function SubscriptionReviewDetailRouteLoading() {
  return PlanReviewsRouteLoading({
    headingId: "subscription-review-detail-loading-heading",
    className: pageShellMax5xl,
    leading: <div className={skelH10W64} />,
    titleKey: "saved",
  });
}

export function SubscriptionReviewsRouteLoading() {
  return PlanReviewsRouteLoading({
    headingId: "subscription-reviews-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className={skelH10W64} />,
    titleKey: "title",
  });
}

export function SubscriptionReviewNewRouteLoading() {
  return PlanReviewsRouteLoading({
    headingId: "subscription-review-new-loading-heading",
    className: pageShellMax5xl,
    rows: 0,
    leading: (
      <>
        <div className={skelH10W64} />
        <div className={skelH28} />
      </>
    ),
    titleKey: "newReview",
  });
}
