import type { ReactNode } from "react";
import { pageShellStack6 } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { discoveryCopy } from "../discovery-copy";

type Copy = ReturnType<typeof discoveryCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function DiscoveryRouteLoading({
  headingId,
  titleKey,
  loadingKey = "organizationsLoading",
  title,
  loading,
  className = pageShellStack6,
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
    throw new Error("DiscoveryRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? (
      <div className="h-11 max-w-full rounded bg-inset" />
    ) : (
      (leading ?? undefined)
    );
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
      const copy = discoveryCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("DiscoveryRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function DiscoveryOrganizationsRouteLoading() {
  return DiscoveryRouteLoading({
    headingId: "organizations-loading-heading",
    className: pageShellStack6,
    rowClassName: "h-24 max-w-full rounded bg-inset",
    rows: 4,
    leading: <div className="h-11 max-w-full rounded bg-inset" />,
    titleKey: "organizationsTitle",
    loadingKey: "organizationsLoading",
  });
}
