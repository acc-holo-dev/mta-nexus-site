import {
  AppError,
  LIBRARY_COLLECTION_HISTORY_DAYS,
  LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS,
} from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { libraryCollectionHistoryCopy } from "../lib/library-collection-history-i18n";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref, collectionPageParams } from "../lib/library-collections-query";
import { libraryMembershipHistoryCopy } from "../lib/library-membership-history-i18n";
import {
  libraryMembershipHistoryQuery,
  libraryMembershipHistorySuffix,
  membershipHistoryHref,
} from "../lib/library-membership-history-query";
import { authService } from "../lib/services/auth-service";
import { libraryCollectionsService } from "../lib/services/library-collections-service";
import { LibraryMembershipHistoryEntry } from "./library-membership-history-item";
import { PlatformSignIn } from "./platform-sign-in";
export async function LibraryMembershipHistoryScreen({
  params,
  searchParams,
}: {
  params?: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw, path] = await Promise.all([
    getRequestLocale(),
    cookies(),
    searchParams,
    params,
  ]);
  const c = libraryCollectionsCopy(locale),
    h = libraryCollectionHistoryCopy(locale),
    m = libraryMembershipHistoryCopy(locale),
    dictionary = getDictionary(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) {
    let returnPath = membershipHistoryHref();
    if (path) {
      returnPath = membershipHistoryHref(path.id);
    } else {
      try {
        const query = libraryMembershipHistoryQuery(collectionPageParams(raw));
        returnPath = `${membershipHistoryHref()}?${libraryMembershipHistorySuffix(query)}`;
      } catch {
        // Keep the list route when filters are invalid for unsigned visitors.
      }
    }
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  try {
    const filters = collectionPageParams(raw);
    if (params) {
      if (filters.size) throw new AppError("Unexpected receipt query", 400, "COLLECTION_INVALID");
      let missingReceipt = false;
      const receiptId = (await params).id;
      const receipt = await libraryCollectionsService
        .membershipReceipt(actor, receiptId)
        .catch((error: unknown) => {
          if (error instanceof AppError && error.statusCode === 404) {
            missingReceipt = true;
            return null;
          }
          if (error instanceof AppError) throw error;
          return null;
        });
      if (missingReceipt) notFound();
      if (!receipt) {
        return (
          <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
            <Link
              href={membershipHistoryHref()}
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {m.history}
            </Link>
            <ErrorState
              title={m.loadUnavailable}
              action={
                <Link
                  href={membershipHistoryHref(receiptId)}
                  className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {dictionary.errors.retry}
                </Link>
              }
            />
          </div>
        );
      }
      return (
        <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
          <Link
            href={membershipHistoryHref()}
            className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {m.history}
          </Link>
          <h1>{m.detail}</h1>
          <p>{m.note}</p>
          <LibraryMembershipHistoryEntry item={receipt.item} locale={locale} />
          <p>
            <time dateTime={receipt.generatedAt}>{receipt.generatedAt}</time>
          </p>
        </div>
      );
    }
    const query = libraryMembershipHistoryQuery(filters);
    const retryHref = `${membershipHistoryHref()}?${libraryMembershipHistorySuffix(query)}`;
    const result = await libraryCollectionsService
      .membershipHistory(actor, query)
      .catch((error: unknown) => {
        if (error instanceof AppError) throw error;
        return null;
      });
    if (!result) {
      return (
        <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
          <ErrorState
            title={m.loadUnavailable}
            action={
              <Link
                href={retryHref}
                className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    const suffix = (page: number) => libraryMembershipHistorySuffix({ ...query, page });
    const filtered =
      result.operation !== "all" ||
      Boolean(result.collectionId) ||
      Boolean(result.productId) ||
      result.days !== 30;
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={m.title}>
          <Link
            href={collectionHref()}
            className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {c.title}
          </Link>
          <Link
            href="/workspace/library/collections/history"
            className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {h.title}
          </Link>
        </nav>
        <h1>{m.title}</h1>
        <p className="text-secondary">{m.note}</p>
        <form
          method="get"
          action={membershipHistoryHref()}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="grid gap-1">
            {h.days}
            <select
              name="days"
              defaultValue={result.days}
              className="rounded border border-base bg-surface p-2"
            >
              {LIBRARY_COLLECTION_HISTORY_DAYS.map((days) => (
                <option key={days} value={days}>
                  {days}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            {h.action}
            <select
              name="operation"
              defaultValue={result.operation}
              className="rounded border border-base bg-surface p-2"
            >
              {LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS.map((op) => (
                <option key={op} value={op}>
                  {m[op]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            {h.collectionId}
            <input
              name="collectionId"
              defaultValue={result.collectionId ?? ""}
              maxLength={160}
              pattern="[A-Za-z0-9_-]+"
              className="rounded border border-base bg-surface p-2"
            />
          </label>
          <label className="grid gap-1">
            {h.productId}
            <input
              name="productId"
              defaultValue={result.productId ?? ""}
              maxLength={160}
              pattern="[A-Za-z0-9_-]+"
              className="rounded border border-base bg-surface p-2"
            />
          </label>
          <Button type="submit" variant="outline">
            {h.filter}
          </Button>
          {filtered ? (
            <Link
              href={membershipHistoryHref()}
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {m.clear}
            </Link>
          ) : null}
        </form>
        <p>
          {c.items}: {result.total} ·{" "}
          <time dateTime={result.generatedAt}>{result.generatedAt}</time>
        </p>
        <a
          href={`/api/library/collections/membership-history/export?${suffix(result.page)}`}
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {h.export}
        </a>
        {!result.items.length && (
          <EmptyState
            title={filtered ? m.emptyFiltered : m.emptyNever}
            description={m.note}
            action={
              filtered ? (
                <Link
                  href={membershipHistoryHref()}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {m.clear}
                </Link>
              ) : undefined
            }
          />
        )}
        <ol className="space-y-4">
          {result.items.map((item) => (
            <li key={item.id}>
              <LibraryMembershipHistoryEntry item={item} locale={locale} />
            </li>
          ))}
        </ol>
        {result.totalPages > 1 && (
          <nav aria-label={c.page} className="flex flex-wrap gap-4 text-sm">
            {result.page > 1 && (
              <Link
                href={`${membershipHistoryHref()}?${suffix(result.page - 1)}`}
                className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {c.previous}
              </Link>
            )}
            <span>
              {c.page} {result.page} {c.of} {result.totalPages}
            </span>
            {result.page < result.totalPages && (
              <Link
                href={`${membershipHistoryHref()}?${suffix(result.page + 1)}`}
                className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {c.next}
              </Link>
            )}
          </nav>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_NOT_FOUND") throw error;
    if (!(error instanceof AppError)) {
      return (
        <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
          <ErrorState
            title={m.loadUnavailable}
            action={
              <Link
                href={membershipHistoryHref()}
                className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    if (error.statusCode === 404) notFound();
    return (
      <section className="mx-auto max-w-xl space-y-4 py-16">
        <p role="alert">{libraryCollectionError(locale, error.code)}</p>
        <Link
          href={membershipHistoryHref()}
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {c.reload}
        </Link>
      </section>
    );
  }
}
