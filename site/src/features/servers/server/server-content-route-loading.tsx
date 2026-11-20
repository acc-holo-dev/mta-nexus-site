import type { ReactNode } from "react";
import { pageShellMax3xl, pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W64 } from "../../shell/skeleton-shell";
import { serverContentCopy } from "../server-content-copy";

type Copy = ReturnType<typeof serverContentCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function ServerContentRouteLoading({
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
  /** Pass `null` to omit the default leading pulse block. */
  leading?: ReactNode | null;
}) {
  if (titleKey === undefined && title === undefined) {
    throw new Error("ServerContentRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className={skelH10W64} /> : (leading ?? undefined);
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
      const copy = serverContentCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("ServerContentRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function ServerContentDetailRouteLoading() {
  return ServerContentRouteLoading({
    headingId: "server-content-detail-loading-heading",
    className: pageShellMax3xl,
    rows: 4,
    leading: <div className={skelH10W64} />,
    titleKey: "title",
  });
}

export function ServersServerContentRouteLoading() {
  return ServerContentRouteLoading({
    headingId: "server-content-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    leading: <div className={skelH10W64} />,
    titleKey: "title",
  });
}

export function ServerContentNewRouteLoading() {
  return ServerContentRouteLoading({
    headingId: "server-content-new-loading-heading",
    className: pageShellMax3xl,
    rows: 4,
    leading: <div className={skelH10W64} />,
    titleKey: "new",
  });
}
