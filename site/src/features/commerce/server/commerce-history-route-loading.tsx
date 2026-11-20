import type { ReactNode } from "react";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { getCommerceHistoryCopy } from "../commerce-history-i18n";

type HistoryCopy = ReturnType<typeof getCommerceHistoryCopy>;
type HistoryStringKey = {
  [K in keyof HistoryCopy]-?: HistoryCopy[K] extends string ? K : never;
}[keyof HistoryCopy];

export function CommerceHistoryRouteLoading({
  headingId,
  titleKey,
  title,
  className = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey?: HistoryStringKey;
  title?: (locale: "en" | "ru") => ReactNode;
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
    throw new Error("CommerceHistoryRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className="h-10 w-64 rounded bg-inset" /> : (leading ?? undefined);
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
      const history = getCommerceHistoryCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? history[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("CommerceHistoryRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: history.loading,
      };
    },
  });
}
