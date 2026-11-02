"use client";

import { Button, fieldClass } from "@nexus/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "../lib/i18n";
import {
  contentPageHref,
  type parseContentPage,
  type writerTypes,
} from "../lib/user-platform-contract";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
import { authEntryHref } from "./auth-return-path";

type Filters = ReturnType<typeof parseContentPage>;
export function ContentCatalogControls({
  path,
  filters,
  locale,
  types,
  showStatus = false,
}: {
  path: string;
  filters: Filters;
  locale: Locale;
  types: readonly (typeof writerTypes)[number][];
  showStatus?: boolean;
}) {
  const copy = getUserPlatformCopy(locale);
  return (
    <search aria-label={copy.search}>
      <form action={path} method="get" className="nexus-panel flex flex-wrap items-end gap-3 p-4">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-secondary">
          <span>{copy.search}</span>
          <input
            type="search"
            name="q"
            maxLength={120}
            defaultValue={filters.query}
            className={`min-w-40 ${fieldClass}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-secondary">
          <span>{copy.type}</span>
          <select name="type" defaultValue={filters.type ?? "all"} className={fieldClass}>
            <option value="all">{copy.all}</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {copy[type]}
              </option>
            ))}
          </select>
        </label>
        {showStatus && (
          <label className="flex flex-col gap-1 text-xs text-secondary">
            <span>{copy.status}</span>
            <select name="status" defaultValue={filters.status ?? "all"} className={fieldClass}>
              <option value="all">{copy.all}</option>
              {(["draft", "published", "archived"] as const).map((status) => (
                <option key={status} value={status}>
                  {copy[status]}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit">{copy.apply}</Button>
        {(filters.query || filters.type || filters.status) && (
          <Link
            href={path}
            className="py-2 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.reset}
          </Link>
        )}
      </form>
    </search>
  );
}

const pageNavFocusClass =
  "text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function ContentPageNavigation({
  path,
  filters,
  page,
  hasMore,
  locale,
}: {
  path: string;
  filters: Filters;
  page: number;
  hasMore: boolean;
  locale: Locale;
}) {
  const copy = getUserPlatformCopy(locale);
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label={copy.page} className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link
          href={contentPageHref(path, filters, page - 1)}
          rel="prev"
          className={pageNavFocusClass}
        >
          {copy.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-secondary">
        {copy.page} {page}
      </span>
      {hasMore ? (
        <Link
          href={contentPageHref(path, filters, page + 1)}
          rel="next"
          className={pageNavFocusClass}
        >
          {copy.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
const platformSignInFocusClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function PlatformSignIn({
  locale,
  returnPath,
}: {
  locale: Locale;
  returnPath?: string | null;
}) {
  const pathname = usePathname();
  const copy = getDictionary(locale).workspace;
  const nextPath = returnPath !== undefined ? returnPath : pathname;
  return (
    <section className="space-y-4 py-16 text-center">
      <h1 className="font-display text-primary">{copy.signInRequired}</h1>
      {copy.signInMessage ? (
        <p className="mx-auto max-w-md text-sm text-secondary">{copy.signInMessage}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href={authEntryHref("login", nextPath)}
          className={`inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white underline-offset-4 hover:underline ${platformSignInFocusClass}`}
        >
          {copy.signIn}
        </Link>
        <Link
          href={authEntryHref("register", nextPath)}
          className={`inline-flex min-h-11 items-center text-sm text-secondary underline ${platformSignInFocusClass}`}
        >
          {copy.createAccount}
        </Link>
      </div>
    </section>
  );
}
