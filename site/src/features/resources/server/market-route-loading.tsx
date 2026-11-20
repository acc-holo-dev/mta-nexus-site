import type { ReactNode } from "react";
import { pageShellStack6 } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH11, skelH24, skelH32 } from "../../shell/skeleton-shell";

function MarketRouteLoading({
  headingId,
  titlePath = "market.title",
  loadingPath = "market.loading",
  className = pageShellStack6,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 6,
  rowClassName = "h-40 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titlePath?: string;
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
    leading === undefined ? (
      <>
        <div className={skelH11} />
        <div className="h-10 w-80 max-w-full rounded bg-inset" />
      </>
    ) : (
      (leading ?? undefined)
    );
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

export function MarketResourceRouteLoading() {
  return MarketRouteLoading({
    headingId: "market-resource-loading-heading",
    rows: 0,
    leading: (
      <>
        <div className="h-48 rounded bg-inset" />
        <div className="h-8 w-64 max-w-full rounded bg-inset" />
        <div className={skelH24} />
        <div className={skelH32} />
      </>
    ),
  });
}

export function ResourcesMarketRouteLoading() {
  return MarketRouteLoading({
    headingId: "market-loading-heading",
  });
}
