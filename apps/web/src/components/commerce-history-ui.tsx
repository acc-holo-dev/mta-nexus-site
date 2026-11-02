import Link from "next/link";
import type { ReactNode } from "react";

const filterNavLinkClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

import type { getCommerceHistoryCopy } from "../lib/commerce-history-i18n";
import { authEntryHref } from "./auth-return-path";

export type HistoryArea = "purchases" | "licenses" | "sales";
export type HistoryCopy = ReturnType<typeof getCommerceHistoryCopy>;

export function HistorySignIn({ copy, returnPath }: { copy: HistoryCopy; returnPath: string }) {
  return (
    <section className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <h1 className="font-display text-primary">{copy.signInRequired}</h1>
      <Link
        href={authEntryHref("login", returnPath)}
        className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.signIn}
      </Link>
    </section>
  );
}

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
    <div className="mx-auto max-w-5xl space-y-7 py-8">
      <header className="space-y-3 border-b border-base pb-6">
        <Link
          href="/workspace"
          className="rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.back}
        </Link>
        <h1 className="font-display text-primary">{titles[area]}</h1>
        <p className="max-w-2xl text-sm text-secondary">{descriptions[area]}</p>
      </header>
      <nav aria-label={copy.navigation} className="flex flex-wrap gap-2">
        {(Object.keys(titles) as HistoryArea[]).map((key) => (
          <Link
            key={key}
            href={`/workspace/${key}`}
            aria-current={key === area ? "page" : undefined}
            className={`rounded-md border border-base px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary aria-[current=page]:bg-accent aria-[current=page]:text-white ${filterNavLinkClass}`}
          >
            {copy.tabs[key]}
          </Link>
        ))}
      </nav>
      <p role="note" className="rounded-lg border border-base bg-surface p-4 text-sm text-muted">
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
        <Link
          href={`/workspace/${area}?page=${page - 1}`}
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-secondary">
        {copy.page} {page} {copy.of} {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={`/workspace/${area}?page=${page + 1}`}
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
