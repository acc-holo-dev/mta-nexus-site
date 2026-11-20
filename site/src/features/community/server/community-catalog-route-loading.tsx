import type { ReactNode } from "react";
import { pageShellMax3xl, pageShellStack6 } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH11, skelH28, skelH40 } from "../../shell/skeleton-shell";

function CommunityCatalogRouteLoading({
  headingId = "community-loading-heading",
  titlePath = "community.title",
  loadingPath = "community.loading",
  className = pageShellStack6,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 5,
  rowClassName = "h-24 rounded bg-inset",
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

export function CommunityNewRouteLoading() {
  return CommunityCatalogRouteLoading({
    headingId: "community-new-loading-heading",
    titlePath: "community.startTitle",
    className: pageShellMax3xl,
    rows: 0,
    leading: (
      <>
        <div className={skelH11} />
        <div className={skelH40} />
        <div className={skelH28} />
      </>
    ),
  });
}

export function CommunityCatalogIndexRouteLoading() {
  return CommunityCatalogRouteLoading({
    headerClassName: "space-y-2 border-b border-base pb-5",
  });
}
