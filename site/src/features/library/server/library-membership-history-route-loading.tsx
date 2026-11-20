import type { ReactNode } from "react";
import { pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { libraryMembershipHistoryCopy } from "../library-membership-history-i18n";

type Copy = ReturnType<typeof libraryMembershipHistoryCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

export function LibraryMembershipHistoryRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax5xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
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
  leading?: ReactNode | null;
}) {
  if (titleKey === undefined && title === undefined) {
    throw new Error("LibraryMembershipHistoryRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className="h-10 w-72 rounded bg-inset" /> : (leading ?? undefined);
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
      const copy = libraryMembershipHistoryCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("LibraryMembershipHistoryRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}
