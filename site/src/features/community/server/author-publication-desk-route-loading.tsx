import type { ReactNode } from "react";
import {
  pageShellMax3xlTight,
  pageShellMax4xlDense,
  pageShellMax5xl,
  pageShellMax5xlTight,
} from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH6W23, skelH10W64, skelH11, skelH32, skelH64 } from "../../shell/skeleton-shell";
import { authorPublicationDeskCopy } from "../author-publication-desk-copy";
import { getUserPlatformCopy } from "../user-platform-copy";

type Copy = ReturnType<typeof authorPublicationDeskCopy>;
type StringKey = {
  [K in keyof Copy]-?: Copy[K] extends string ? K : never;
}[keyof Copy];

function AuthorPublicationDeskRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  title,
  loading,
  className = pageShellMax5xlTight,
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
    throw new Error("AuthorPublicationDeskRouteLoading requires titleKey or title");
  }
  const resolvedLeading =
    leading === undefined ? <div className={skelH10W64} /> : (leading ?? undefined);
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
      const copy = authorPublicationDeskCopy(typedLocale);
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

export function ContentHistoryRouteLoading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "content-history-loading-heading",
    className: pageShellMax5xl,
    rows: 4,
    titleKey: "history",
  });
}

export function PublicationDeskRouteLoading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "publication-desk-loading-heading",
    leading: <div className={skelH32} />,
    titleKey: "title",
  });
}

export function ContentNewRouteLoading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "content-new-loading-heading",
    className: pageShellMax3xlTight,
    rows: 0,
    leading: (
      <>
        <div className={skelH11} />
        <div className={skelH64} />
      </>
    ),
    titleKey: "title",
  });
}

export function CommunityContentHistoryRouteLoading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "content-history-loading-heading",
    className: pageShellMax4xlDense,
    headerClassName: "",
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className={skelH6W23} />,
    titleKey: "title",
  });
}

export function EditPublicationRouteLoading() {
  return AuthorPublicationDeskRouteLoading({
    headingId: "edit-publication-loading-heading",
    className: pageShellMax3xlTight,
    rowClassName: "h-16 rounded bg-inset",
    leading: (
      <>
        <div className="h-10 w-40 rounded bg-inset" />
        <div className={skelH32} />
      </>
    ),
    title: (locale) => getUserPlatformCopy(locale).edit,
  });
}
