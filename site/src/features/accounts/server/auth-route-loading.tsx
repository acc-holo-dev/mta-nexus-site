import type { ReactNode } from "react";
import { pageShellMaxMdAuthTall } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";

export function AuthRouteLoading({
  headingId,
  titlePath,
  loadingPath = "errors.loading",
  className = pageShellMaxMdAuthTall,
  headerClassName = "space-y-2 text-center",
  titleClassName,
  statusClassName,
  rows = 0,
  rowClassName = "h-11 rounded bg-inset",
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
  leading?: ReactNode;
}) {
  return DictionaryFieldRouteLoading({
    headingId,
    titlePath,
    loadingPath,
    className,
    headerClassName,
    ...(titleClassName !== undefined ? { titleClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    ...(leading !== undefined ? { leading } : {}),
  });
}
