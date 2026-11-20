import type { ReactNode } from "react";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { getOrganizationCopy } from "../organization-workspace-copy";

type OrgCopy = ReturnType<typeof getOrganizationCopy>;
type OrgStringKey = {
  [K in keyof OrgCopy]-?: OrgCopy[K] extends string ? K : never;
}[keyof OrgCopy];

export function OrganizationWorkspaceRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  className = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
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
      const copy = getOrganizationCopy(locale === "ru" ? "ru" : "en");
      return {
        title: copy[titleKey],
        loading: copy[loadingKey],
      };
    },
  });
}
