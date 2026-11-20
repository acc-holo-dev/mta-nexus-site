import { typeSpace2BorderBPb6 } from "../../shell/type-shell";
import type { ReactNode } from "react";
import { pageShellMax4xl, pageShellMax5xlTight, pageShellStack6 } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10WFullMaxMd, skelH24, skelH28, skelH40 } from "../../shell/skeleton-shell";

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
    leading === undefined ? <div className={skelH24} /> : (leading ?? undefined);
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
    headerClassName: typeSpace2BorderBPb6,
    leading: <div className={skelH10WFullMaxMd} />,
  });
}

export function AdminSupportRouteLoading() {
  return SupportWorkspaceRouteLoading({
    headingId: "admin-support-loading-heading",
    titlePath: "support.staffQueue",
    className: pageShellMax5xlTight,
    headerClassName: typeSpace2BorderBPb6,
    leading: <div className={skelH28} />,
  });
}

export function SupportCaseRouteLoading() {
  return SupportWorkspaceRouteLoading({
    headingId: "support-case-loading-heading",
    className: pageShellStack6,
    rows: 0,
    leading: (
      <>
        <div className={skelH24} />
        <div className={skelH40} />
        <div className={skelH28} />
      </>
    ),
  });
}
