import type { ReactNode } from "react";
import { pageShellMax5xlTight } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH28 } from "../../shell/skeleton-shell";
import { communityReportCopy } from "../community-report-copy";

type Copy = ReturnType<typeof communityReportCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function CommunityReportRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax5xlTight,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 3,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey?: StringKey;
  loadingKey?: StringKey;
  title?: (locale: "en" | "ru") => ReactNode;
  loading?: (locale: "en" | "ru") => ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  /** Pass `null` to omit the default leading pulse block. */
  leading?: ReactNode | null;
}) {
  if (titleKey === undefined && title === undefined) {
    throw new Error("CommunityReportRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className={skelH28} /> : (leading ?? undefined);
  return LocaleCopyRouteLoading({
    headingId,
    className,
    ...(headerClassName !== undefined ? { headerClassName } : {}),
    ...(titleClassName !== undefined ? { titleClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    ...(resolvedLeading !== undefined ? { leading: resolvedLeading } : {}),
    load: (locale) => {
      const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
      const copy = communityReportCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("missing route loading title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function AdminReportDetailRouteLoading() {
  return CommunityReportRouteLoading({
    headingId: "admin-report-detail-loading-heading",
    titleKey: "detail",
  });
}

export function AdminReportsRouteLoading() {
  return CommunityReportRouteLoading({
    headingId: "admin-reports-loading-heading",
    titleKey: "queue",
  });
}

export function WorkspaceReportDetailRouteLoading() {
  return CommunityReportRouteLoading({
    headingId: "workspace-report-detail-loading-heading",
    titleKey: "detail",
  });
}

export function WorkspaceReportsRouteLoading() {
  return CommunityReportRouteLoading({
    headingId: "workspace-reports-loading-heading",
    titleKey: "title",
  });
}
