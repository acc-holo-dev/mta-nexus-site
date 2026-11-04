"use client";

import { Button, FilterBar, fieldClass, SearchField } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import {
  contentPageHref,
  type parseContentPage,
  type writerTypes,
} from "../lib/user-platform-contract";
import { getUserPlatformCopy } from "../lib/user-platform-copy";

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
    <FilterBar action={path} label={copy.search}>
      <div className="min-w-0 flex-1">
        <SearchField
          label={copy.search}
          name="q"
          maxLength={120}
          defaultValue={filters.query}
          className={`min-w-40 ${fieldClass}`}
        />
      </div>
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
    </FilterBar>
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
