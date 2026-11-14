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

const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
          className={`min-h-11 min-w-40 ${fieldClass}`}
        />
      </div>
      <label className="flex flex-col gap-1 text-xs text-secondary">
        <span>{copy.type}</span>
        <select
          name="type"
          defaultValue={filters.type ?? "all"}
          className={`${fieldClass} min-h-11`}
        >
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
          <select
            name="status"
            defaultValue={filters.status ?? "all"}
            className={`${fieldClass} min-h-11`}
          >
            <option value="all">{copy.all}</option>
            {(["draft", "published", "archived"] as const).map((status) => (
              <option key={status} value={status}>
                {copy[status]}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button type="submit" className="min-h-11">
        {copy.apply}
      </Button>
      {(filters.query || filters.type || filters.status) && (
        <Link href={path} className={navLinkClass}>
          {copy.reset}
        </Link>
      )}
    </FilterBar>
  );
}

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
    <nav
      aria-label={copy.page}
      className="flex min-w-0 items-center justify-between gap-3 overflow-x-clip text-sm"
    >
      {page > 1 ? (
        <Link href={contentPageHref(path, filters, page - 1)} rel="prev" className={navLinkClass}>
          {copy.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="inline-flex min-h-11 items-center text-secondary">
        {copy.page} {page}
      </span>
      {hasMore ? (
        <Link href={contentPageHref(path, filters, page + 1)} rel="next" className={navLinkClass}>
          {copy.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
