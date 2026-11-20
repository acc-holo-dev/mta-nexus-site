import type { ReactNode } from "react";
import { getDictionary } from "../../../lib/i18n";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";

export function AdminResourceRouteLoading({
  headingId,
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
  title: (locale: "en" | "ru") => ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode | null;
}) {
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
      return {
        title: title(typedLocale),
        loading: getDictionary(typedLocale).admin.loading,
      };
    },
  });
}
