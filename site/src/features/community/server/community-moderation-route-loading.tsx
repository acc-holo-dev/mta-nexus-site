import type { ReactNode } from "react";
import { pageShellMax4xlTight } from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH24 } from "../../shell/skeleton-shell";
import { moderationCopy } from "../community-moderation-copy";
import { discussionReportsCopy } from "../discussion-reports-copy";
import { moderatedDiscussionCopy } from "../moderated-discussion-copy";

type Copy = ReturnType<typeof moderationCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function CommunityModerationRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax4xlTight,
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
  /** Pass `null` to omit the default leading pulse block. */
  leading?: ReactNode | null;
}) {
  if (titleKey === undefined && title === undefined) {
    throw new Error("CommunityModerationRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className={skelH24} /> : (leading ?? undefined);
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
      const copy = moderationCopy(typedLocale);
      const resolvedTitle =
        title?.(typedLocale) ?? (titleKey !== undefined ? copy[titleKey] : undefined);
      if (resolvedTitle === undefined) {
        throw new Error("missing route loading title");
      }
      return {
        title: resolvedTitle,
        loading: loading ? loading(typedLocale) : copy[loadingKey],
      };
    },
  });
}

export function AdminCommunityItemRouteLoading() {
  return CommunityModerationRouteLoading({
    headingId: "admin-community-item-loading-heading",
    titleKey: "title",
  });
}

export function AdminCommunityRouteLoading() {
  return CommunityModerationRouteLoading({
    headingId: "admin-community-loading-heading",
    titleKey: "title",
  });
}

export function AdminDiscussionCommentRouteLoading() {
  return CommunityModerationRouteLoading({
    headingId: "admin-discussion-comment-loading-heading",
    titleClassName: "text-2xl font-extrabold text-primary",
    title: (locale) => moderatedDiscussionCopy(locale).title,
  });
}

export function AdminDiscussionReportsRouteLoading() {
  return CommunityModerationRouteLoading({
    headingId: "admin-discussion-reports-loading-heading",
    titleClassName: "text-2xl font-extrabold text-primary",
    title: (locale) => discussionReportsCopy(locale).title,
  });
}

export function AdminDiscussionRouteLoading() {
  return CommunityModerationRouteLoading({
    headingId: "admin-discussion-loading-heading",
    titleClassName: "text-2xl font-extrabold text-primary",
    title: (locale) => moderatedDiscussionCopy(locale).title,
  });
}
