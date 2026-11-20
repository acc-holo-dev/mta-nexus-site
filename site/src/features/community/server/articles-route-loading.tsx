import type { ReactNode } from "react";
import { pageShellMax4xlTight, pageShellStack8 } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";

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
    leading === undefined ? <div className="h-11 rounded bg-inset" /> : (leading ?? undefined);
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
        <div className="h-10 w-72 max-w-full rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-64 rounded bg-inset" />
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
