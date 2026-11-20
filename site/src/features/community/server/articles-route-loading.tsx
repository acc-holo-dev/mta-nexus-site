import type { ReactNode } from "react";
import { pageShellMax4xlTight, pageShellStack8 } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W72Max, skelH11, skelH40, skelH64 } from "../../shell/skeleton-shell";

function ArticlesRouteLoading({
  headingId = "articles-loading-heading",
  titlePath = "articles.title",
  loadingPath = "articles.loading",
  className = pageShellStack8,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-28 rounded bg-inset",
  leading,
}: {
  headingId?: string;
  titlePath?: string;
  loadingPath?: string;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode | null;
} = {}) {
  const resolvedLeading =
    leading === undefined ? <div className={skelH11} /> : (leading ?? undefined);
  return DictionaryFieldRouteLoading({
    headingId,
    titlePath,
    loadingPath,
    className,
    ...(headerClassName !== undefined ? { headerClassName } : {}),
    ...(titleClassName !== undefined ? { titleClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    ...(resolvedLeading !== undefined ? { leading: resolvedLeading } : {}),
  });
}

export function ArticleRouteLoading() {
  return ArticlesRouteLoading({
    headingId: "article-loading-heading",
    className: pageShellMax4xlTight,
    rows: 0,
    leading: (
      <>
        <div className={skelH10W72Max} />
        <div className={skelH40} />
        <div className={skelH64} />
      </>
    ),
  });
}

export function ArticlesIndexRouteLoading() {
  return ArticlesRouteLoading({
    headerClassName: "space-y-2 border-b border-base pb-6",
    titleClassName: "text-2xl font-extrabold text-primary sm:text-3xl",
  });
}
