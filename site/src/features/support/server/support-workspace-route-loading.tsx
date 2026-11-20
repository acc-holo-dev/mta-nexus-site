import type { ReactNode } from "react";
import { pageShellMax4xl, pageShellMax5xlTight, pageShellStack6 } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";

export function SupportWorkspaceRouteLoading({
  headingId = "support-loading-heading",
  titlePath = "support.title",
  loadingPath = "support.loading",
  className = pageShellMax4xl,
  headerClassName,
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
    leading === undefined ? <div className="h-24 rounded bg-inset" /> : (leading ?? undefined);
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

export function AdminSupportCaseRouteLoading() {
  return SupportWorkspaceRouteLoading({
    headingId: "admin-support-case-loading-heading",
    titlePath: "support.staffQueue",
    className: pageShellMax5xlTight,
    headerClassName: "space-y-2 border-b border-base pb-6",
    leading: <div className="h-10 w-full max-w-md rounded bg-inset" />,
  });
}

export function AdminSupportRouteLoading() {
  return SupportWorkspaceRouteLoading({
    headingId: "admin-support-loading-heading",
    titlePath: "support.staffQueue",
    className: pageShellMax5xlTight,
    headerClassName: "space-y-2 border-b border-base pb-6",
    leading: <div className="h-28 rounded bg-inset" />,
  });
}

export function SupportCaseRouteLoading() {
  return SupportWorkspaceRouteLoading({
    headingId: "support-case-loading-heading",
    className: pageShellStack6,
    rows: 0,
    leading: (
      <>
        <div className="h-24 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </>
    ),
  });
}
