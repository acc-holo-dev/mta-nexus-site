import type { ReactNode } from "react";
import { pageShellStack6, pageShellStack8 } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";

export function ServersDirectoryRouteLoading({
  headingId = "servers-loading-heading",
  titlePath = "servers.title",
  loadingPath = "servers.loading",
  className = pageShellStack8,
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

export function ServerDetailRouteLoading() {
  return ServersDirectoryRouteLoading({
    headingId: "server-detail-loading-heading",
    titlePath: "serverDetail.breadcrumb",
    loadingPath: "serverDetail.loading",
    className: pageShellStack6,
    rows: 0,
    leading: (
      <>
        <div className="h-32 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
      </>
    ),
  });
}
