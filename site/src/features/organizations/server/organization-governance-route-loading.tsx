import type { ReactNode } from "react";
import { pageShellMax5xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { organizationGovernanceCopy } from "../organization-governance-copy";

type Copy = ReturnType<typeof organizationGovernanceCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function OrganizationGovernanceRouteLoading({
  headingId,
  titleKey,
  loadingKey = "historyDescription",
  title,
  loading,
  className = pageShellMax5xl,
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
    throw new Error("OrganizationGovernanceRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? (
      <div className="h-10 w-2/3 max-w-md rounded bg-inset" />
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
      const copy = organizationGovernanceCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("OrganizationGovernanceRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function OrganizationActivityRouteLoading() {
  return OrganizationGovernanceRouteLoading({
    headingId: "organization-activity-loading-heading",
    className: pageShellMax5xl,
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-10 w-2/3 max-w-md rounded bg-inset" />,
    titleKey: "history",
    loadingKey: "historyDescription",
  });
}
