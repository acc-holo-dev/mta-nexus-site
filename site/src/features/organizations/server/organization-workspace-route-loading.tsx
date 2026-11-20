import type { ReactNode } from "react";
import {
  pageShellMax3xlCompact,
  pageShellMax5xl,
  pageShellMax5xlCompact,
} from "../../shell/page-shell";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { skelH10W23MaxMd, skelH28 } from "../../shell/skeleton-shell";
import { getOrganizationCopy } from "../organization-workspace-copy";

type OrgCopy = ReturnType<typeof getOrganizationCopy>;
type OrgStringKey = {
  [K in keyof OrgCopy]-?: OrgCopy[K] extends string ? K : never;
}[keyof OrgCopy];

function OrganizationWorkspaceRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  className = pageShellMax5xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 3,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey: OrgStringKey;
  loadingKey?: OrgStringKey;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  /** Pass `null` to omit the default leading pulse block. */
  leading?: ReactNode | null;
}) {
  const resolvedLeading =
    leading === undefined ? <div className={skelH10W23MaxMd} /> : (leading ?? undefined);
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
      const copy = getOrganizationCopy(locale === "ru" ? "ru" : "en");
      return {
        title: copy[titleKey],
        loading: copy[loadingKey],
      };
    },
  });
}

export function OrganizationRouteLoading() {
  return OrganizationWorkspaceRouteLoading({
    headingId: "organization-loading-heading",
    className: pageShellMax5xlCompact,
    rowClassName: "h-28 rounded bg-inset",
    titleKey: "profile",
  });
}

export function OrganizationsRouteLoading() {
  return OrganizationWorkspaceRouteLoading({
    headingId: "organizations-loading-heading",
    titleKey: "title",
    loadingKey: "listLoading",
    leading: <div className={skelH28} />,
  });
}

export function OrgNewRouteLoading() {
  return OrganizationWorkspaceRouteLoading({
    headingId: "org-new-loading-heading",
    className: pageShellMax3xlCompact,
    titleKey: "create",
  });
}
