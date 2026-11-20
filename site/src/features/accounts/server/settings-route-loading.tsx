import type { ReactNode } from "react";
import { pageShellMax3xl, pageShellMax3xlRoomy } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH4W13, skelH20, skelH28 } from "../../shell/skeleton-shell";

function SettingsRouteLoading({
  headingId = "settings-loading-heading",
  titlePath = "settings.title",
  loadingPath = "settings.loading",
  className = pageShellMax3xlRoomy,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 0,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId?: string;
  titlePath?: string;
  loadingPath?: string;
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
        <div className={skelH4W13} />
        <div className={skelH20} />
      </>
    ) : (
      (leading ?? undefined)
    );
  return DictionaryFieldRouteLoading({
    headingId,
    titlePath,
    loadingPath,
    className,
    ...(headerClassName !== undefined ? { headerClassName } : {}),
    ...(titleClassName !== undefined ? { titleClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    ...(resolvedLeading !== undefined ? { leading: resolvedLeading } : {}),
  });
}

export function DeveloperSettingsRouteLoading() {
  return SettingsRouteLoading({
    headingId: "developer-settings-loading-heading",
    className: pageShellMax3xl,
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className={skelH28} />,
  });
}

export function SettingsIndexRouteLoading() {
  return SettingsRouteLoading({
    headerClassName: "",
    statusClassName: "mt-1 font-caption text-muted",
  });
}
