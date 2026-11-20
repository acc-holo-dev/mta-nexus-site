import Link from "next/link";
import type { ReactNode } from "react";
import { linkAccentTight, linkAccentTightSmRounded, linkFocusRing } from "../../shell/link-shell";
import { pageShellMax5xlMid } from "../../shell/page-shell";
import { surfaceBgP4TextSmMuted, surfaceSpace3BorderBPb6 } from "../../shell/surface-shell";
import {
  typeDisplayPrimary,
  typeFlexWrapGap2,
  typeMax2xlSmSecondary,
} from "../../shell/type-shell";
import type { getCommerceHistoryCopy } from "../commerce-history-i18n";
export type HistoryArea = "purchases" | "licenses" | "sales";
export type HistoryCopy = ReturnType<typeof getCommerceHistoryCopy>;

export function HistoryShell({
  copy,
  area,
  children,
}: {
  copy: HistoryCopy;
  area: HistoryArea;
  children: ReactNode;
}) {
  const titles = {
    purchases: copy.purchasesTitle,
    licenses: copy.licensesTitle,
    sales: copy.salesTitle,
  };
  const descriptions = {
    purchases: copy.purchasesDescription,
    licenses: copy.licensesDescription,
    sales: copy.salesDescription,
  };
  return (
    <div className={pageShellMax5xlMid}>
      <header className={surfaceSpace3BorderBPb6}>
        <Link href="/workspace" className={linkAccentTightSmRounded}>
          {copy.back}
        </Link>
        <h1 className={typeDisplayPrimary}>{titles[area]}</h1>
        <p className={typeMax2xlSmSecondary}>{descriptions[area]}</p>
      </header>
      <nav aria-label={copy.navigation} className={typeFlexWrapGap2}>
        {(Object.keys(titles) as HistoryArea[]).map((key) => (
          <Link
            key={key}
            href={`/workspace/${key}`}
            aria-current={key === area ? "page" : undefined}
            className={`rounded-md border border-base px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary aria-[current=page]:bg-accent aria-[current=page]:text-white ${linkFocusRing}`}
          >
            {copy.tabs[key]}
          </Link>
        ))}
      </nav>
      <p role="note" className={surfaceBgP4TextSmMuted}>
        {copy.betaNotice}
      </p>
      {children}
    </div>
  );
}

export function HistoryPagination({
  copy,
  area,
  page,
  totalPages,
}: {
  copy: HistoryCopy;
  area: HistoryArea;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={copy.page} className="flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={`/workspace/${area}?page=${page - 1}`} className={linkAccentTight}>
          {copy.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-secondary">
        {copy.page} {page} {copy.of} {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`/workspace/${area}?page=${page + 1}`} className={linkAccentTight}>
          {copy.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
