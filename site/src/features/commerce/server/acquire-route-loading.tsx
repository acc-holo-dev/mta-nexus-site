import type { ReactNode } from "react";
import { pageShellMax3xl } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH12W48, skelH20, skelH28 } from "../../shell/skeleton-shell";

export function AcquireRouteLoading({
  headingId = "acquire-loading-heading",
  titlePath = "checkout.title",
  loadingPath = "checkout.loadingProduct",
  className = pageShellMax3xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 0,
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
    leading === undefined ? (
      <>
        <div className={skelH28} />
        <div className={skelH12W48} />
        <div className={skelH20} />
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
