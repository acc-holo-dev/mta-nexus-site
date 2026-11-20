import type { ReactNode } from "react";
import { pageShellMax4xlTight, pageShellMax5xlTight } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH24, skelH32 } from "../../shell/skeleton-shell";
import { reportGroupsCopy } from "../community-report-groups-copy";

type Copy = ReturnType<typeof reportGroupsCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function CommunityReportGroupsRouteLoading({
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
    throw new Error("CommunityReportGroupsRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className={skelH32} /> : (leading ?? undefined);
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
      const copy = reportGroupsCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("CommunityReportGroupsRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function AdminPublicationReportsRouteLoading() {
  return CommunityReportGroupsRouteLoading({
    headingId: "admin-publication-reports-loading-heading",
    className: pageShellMax4xlTight,
    titleClassName: "text-2xl font-extrabold text-primary",
    leading: <div className={skelH24} />,
    titleKey: "publicationTitle",
    loadingKey: "publicationLoading",
  });
}

export function ReportGroupsRouteLoading() {
  return CommunityReportGroupsRouteLoading({
    headingId: "report-groups-loading-heading",
    className: pageShellMax5xlTight,
    leading: <div className={skelH32} />,
    titleKey: "title",
  });
}
