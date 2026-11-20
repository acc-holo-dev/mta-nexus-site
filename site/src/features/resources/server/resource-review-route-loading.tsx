import type { ReactNode } from "react";
import { pageShellMax4xl, pageShellMax5xl, pageShellMax5xlTight } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W64, skelH10W72, skelH28 } from "../../shell/skeleton-shell";
import { resourceReviewCopy } from "../resource-review-i18n";

type ReviewCopy = ReturnType<typeof resourceReviewCopy>;
type ReviewKey = {
  [K in keyof ReviewCopy]-?: ReviewCopy[K] extends string ? K : never;
}[keyof ReviewCopy];

function ResourceReviewRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  className = pageShellMax5xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey: ReviewKey;
  loadingKey?: ReviewKey;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  /** Pass `null` to omit the default leading pulse block. */
  leading?: ReactNode | null;
}) {
  const resolvedLeading =
    leading === undefined ? <div className={skelH10W72} /> : (leading ?? undefined);
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
      const copy = resourceReviewCopy(locale === "ru" ? "ru" : "en");
      return {
        title: copy[titleKey],
        loading: copy[loadingKey],
      };
    },
  });
}

export function AdminCommerceReviewDetailRouteLoading() {
  return ResourceReviewRouteLoading({
    headingId: "admin-commerce-review-detail-loading-heading",
    titleKey: "detail",
  });
}

export function AdminCommerceReviewsRouteLoading() {
  return ResourceReviewRouteLoading({
    headingId: "admin-commerce-reviews-loading-heading",
    titleKey: "queue",
  });
}

export function MarketReviewsRouteLoading() {
  return ResourceReviewRouteLoading({
    headingId: "market-reviews-loading-heading",
    titleKey: "title",
    loadingKey: "pageLoading",
    className: pageShellMax4xl,
    rows: 3,
    leading: null,
    rowClassName: "h-28 rounded bg-inset",
  });
}

export function LibraryReviewRouteLoading() {
  return ResourceReviewRouteLoading({
    headingId: "library-review-loading-heading",
    titleKey: "write",
    loadingKey: "pageLoading",
    leading: <div className={skelH10W64} />,
  });
}

export function LibraryReviewsRouteLoading() {
  return ResourceReviewRouteLoading({
    headingId: "library-reviews-loading-heading",
    titleKey: "own",
    loadingKey: "pageLoading",
    className: pageShellMax5xlTight,
    rows: 3,
    leading: null,
    rowClassName: "h-28 rounded bg-inset",
  });
}

export function ReviewReportRouteLoading() {
  return ResourceReviewRouteLoading({
    headingId: "review-report-loading-heading",
    titleKey: "reports",
    rows: 3,
    leading: <div className={skelH28} />,
  });
}

export function ReviewReportsRouteLoading() {
  return ResourceReviewRouteLoading({
    headingId: "review-reports-loading-heading",
    titleKey: "reports",
    className: pageShellMax5xlTight,
    rows: 3,
    leading: <div className={skelH28} />,
  });
}
