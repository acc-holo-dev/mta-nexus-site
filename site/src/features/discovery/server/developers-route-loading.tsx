import type { ReactNode } from "react";
import { pageShellStack6 } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH11Max, skelH28Max, skelH40Max } from "../../shell/skeleton-shell";

function DevelopersRouteLoading({
  headingId,
  titlePath,
  loadingPath = "developers.loading",
  className = pageShellStack6,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 max-w-full rounded bg-inset",
  leading,
}: {
  headingId: string;
  titlePath: string;
  loadingPath?: string;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode | null;
}) {
  const resolvedLeading =
    leading === undefined ? <div className={skelH11Max} /> : (leading ?? undefined);
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

export function DeveloperRouteLoading() {
  return DevelopersRouteLoading({
    headingId: "developer-loading-heading",
    titlePath: "developers.creatorProfile",
    rows: 0,
    leading: (
      <>
        <div className={skelH28Max} />
        <div className={skelH40Max} />
      </>
    ),
  });
}

export function DiscoveryDevelopersRouteLoading() {
  return DevelopersRouteLoading({
    headingId: "developers-loading-heading",
    titlePath: "developers.title",
    headerClassName: "space-y-2 border-b border-base pb-6",
    titleClassName: "text-2xl font-extrabold text-primary",
  });
}
