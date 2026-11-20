import type { ReactNode } from "react";
import { getDictionary } from "../../../lib/i18n";
import { pageShellMax4xl, pageShellMax6xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { getManagedServerCopy } from "../managed-server-view";

type Copy = ReturnType<typeof getManagedServerCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function ManagedServerRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax6xl,
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
    throw new Error("ManagedServerRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className="h-28 rounded bg-inset" /> : (leading ?? undefined);
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
      const copy = getManagedServerCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("ManagedServerRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function ServerManagementRouteLoading() {
  return ManagedServerRouteLoading({
    headingId: "server-management-loading-heading",
    className: pageShellMax4xl,
    titleClassName: "text-2xl font-black text-primary",
    rows: 3,
    rowClassName: "h-32 rounded bg-inset",
    leading: <div className="h-24 rounded bg-inset" />,
    title: (locale) => getDictionary(locale).serverManagement.listingDetails,
    loading: (locale) => getDictionary(locale).serverDetail.loading,
  });
}

export function ManagedServersRouteLoading() {
  return ManagedServerRouteLoading({
    headingId: "managed-servers-loading-heading",
    className: pageShellMax6xl,
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
