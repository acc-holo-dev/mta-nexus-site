import type { ReactNode } from "react";
import { DictionaryRouteLoading } from "../../shell/route-honest-loading-server";

type AuthorResourcesTitleKey = "title" | "edit";

export function AuthorResourcesRouteLoading({
  headingId,
  titleKey = "title",
  className = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
  headerClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 rounded bg-inset",
  leading = <div className="h-10 w-72 rounded bg-inset" />,
}: {
  headingId: string;
  titleKey?: AuthorResourcesTitleKey;
  className?: string;
  headerClassName?: string;
  statusClassName?: string;
  rows?: number;
  rowClassName?: string;
  leading?: ReactNode;
}) {
  return DictionaryRouteLoading({
    headingId,
    className,
    ...(headerClassName !== undefined ? { headerClassName } : {}),
    ...(statusClassName !== undefined ? { statusClassName } : {}),
    rows,
    rowClassName,
    leading,
    pick: (dictionary) => ({
      title: dictionary.authorResources[titleKey],
      loading: dictionary.authorResources.loading,
    }),
  });
}
