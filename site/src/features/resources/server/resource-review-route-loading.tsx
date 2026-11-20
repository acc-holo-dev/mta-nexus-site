import type { ReactNode } from "react";
import { LocaleCopyRouteLoading } from "../../shell/route-honest-loading-server";
import { resourceReviewCopy } from "../resource-review-i18n";
import { pageShellMax5xl } from "../../shell/page-shell";

type ReviewCopy = ReturnType<typeof resourceReviewCopy>;
type ReviewKey = {
  [K in keyof ReviewCopy]-?: ReviewCopy[K] extends string ? K : never;
}[keyof ReviewCopy];

export function ResourceReviewRouteLoading({
  headingId,
  titleKey,
  loadingKey = "loading",
  className = pageShellMax5xl,
  headerClassName,
  titleClassName,
  statusClassName,
  rows = 4,
  rowClassName = "h-24 rounded bg-inset",
  leading,
}: {
  headingId: string;
  titleKey: ReviewKey;
  loadingKey?: ReviewKey;
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
    leading === undefined ? <div className="h-10 w-72 rounded bg-inset" /> : (leading ?? undefined);
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
      const copy = resourceReviewCopy(locale === "ru" ? "ru" : "en");
      return {
        title: copy[titleKey],
        loading: copy[loadingKey],
      };
    },
  });
}
