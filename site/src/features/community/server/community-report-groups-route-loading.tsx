import type { ReactNode } from "react";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { reportGroupsCopy } from "../community-report-groups-copy";

type Copy = ReturnType<typeof reportGroupsCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

export function CommunityReportGroupsRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
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
    leading === undefined ? <div className="h-32 rounded bg-inset" /> : (leading ?? undefined);
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
