import type { ReactNode } from "react";
import { getDictionary } from "../../../lib/i18n";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { pageShellMax2xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W64, skelH24, skelH40 } from "../../shell/skeleton-shell";
import { typeSmSecondary } from "../../shell/type-shell";

export function ServerRegisterRouteLoading({
  headingId = "server-new-loading-heading",
  className = pageShellMax2xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 0,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId?: string;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode | null;
} = {}) {
  const resolvedLeading =
    leading === undefined ? (
      <>
        <div className={skelH10W64} />
        <div className={skelH40} />
        <div className={skelH24} />
      </>
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
      const copy = getDictionary(typedLocale).serverRegistration;
      const platform = getUserPlatformCopy(typedLocale);
      return {
        title: copy.title,
        description: <p className={typeSmSecondary}>{copy.description}</p>,
        loading: platform.loading,
      };
    },
  });
}
