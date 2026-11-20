import type { ReactNode } from "react";
import { getDictionary } from "../../../lib/i18n";
import { pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W72 } from "../../shell/skeleton-shell";
import { buildPackageCopy } from "../build-package-i18n";
import { getResourceBuildWorkspaceCopy } from "../resource-build-workspace-i18n";
import { resourceMediaCopy } from "../resource-media-i18n";

function AdminResourceRouteLoading({
  headingId,
  title,
  className = pageShellMax5xl,
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
    leading === undefined ? <div className={skelH10W72} /> : (leading ?? undefined);
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

export function AdminResourceBuildRouteLoading() {
  return AdminResourceRouteLoading({
    headingId: "admin-resource-build-loading-heading",
    title: (locale) => getResourceBuildWorkspaceCopy(locale).title,
  });
}

export function AdminResourceBuildPackageRouteLoading() {
  return AdminResourceRouteLoading({
    headingId: "admin-resource-build-package-loading-heading",
    title: (locale) => buildPackageCopy(locale).inventory,
  });
}

export function AdminResourceMediaRouteLoading() {
  return AdminResourceRouteLoading({
    headingId: "admin-resource-media-loading-heading",
    title: (locale) => resourceMediaCopy(locale).title,
  });
}
