import type { ReactNode } from "react";
import { pageShellMax4xlDense } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH6W23 } from "../../shell/skeleton-shell";
import { serverPublicationHistoryCopy } from "../server-publication-history-copy";

type Copy = ReturnType<typeof serverPublicationHistoryCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function ServerPublicationHistoryRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax4xlDense,
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
  leading?: ReactNode | null;
}) {
  if (titleKey === undefined && title === undefined) {
    throw new Error("ServerPublicationHistoryRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className={skelH6W23} /> : (leading ?? undefined);
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
      const copy = serverPublicationHistoryCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("ServerPublicationHistoryRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function ServersContentHistoryRouteLoading() {
  return ServerPublicationHistoryRouteLoading({
    headingId: "content-history-loading-heading",
    className: pageShellMax4xlDense,
    headerClassName: "",
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className={skelH6W23} />,
    titleKey: "title",
  });
}
