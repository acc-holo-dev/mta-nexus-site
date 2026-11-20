import type { ReactNode } from "react";
import { pageShellMax5xl } from "../page-shell";
import { DictionaryFieldRouteLoading } from "../route-honest-loading-server";

export function WorkspaceHubRouteLoading({
  headingId = "workspace-loading-heading",
  titlePath = "workspace.title",
  loadingPath = "workspace.loading",
  className = pageShellMax5xl,
  headerClassName = "min-w-0 space-y-2",
  titleClassName,
  statusClassName,
  rows = 3,
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
    leading === undefined ? <div className="h-28 rounded bg-inset" /> : (leading ?? undefined);
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
    ...(resolvedLeading !== undefined ? { leading: resolvedLeading } : {}),
  });
}
