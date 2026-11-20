import type { ReactNode } from "react";
import { pageShellMax3xl, pageShellMax3xlRoomy } from "../../shell/page-shell";
import { DictionaryFieldRouteLoading } from "../../shell/route-honest-loading-server";

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
        <div className="h-4 w-1/3 rounded bg-inset" />
        <div className="h-20 rounded bg-inset" />
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
    leading: <div className="h-28 rounded bg-inset" />,
  });
}

export function SettingsIndexRouteLoading() {
  return SettingsRouteLoading({
    headerClassName: "",
    statusClassName: "mt-1 font-caption text-muted",
  });
}
