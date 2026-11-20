import type { ReactNode } from "react";
import { pageShellMax4xl } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { ownDiscussionCopy } from "../discussion-workspace-copy";

type Copy = ReturnType<typeof ownDiscussionCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

export function DiscussionWorkspaceRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax4xl,
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
    throw new Error("DiscussionWorkspaceRouteLoading requires titleKey or title");
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
      const copy = ownDiscussionCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("DiscussionWorkspaceRouteLoading missing title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}
