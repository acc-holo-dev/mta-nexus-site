import {
  AppError,
  LIBRARY_COLLECTION_HISTORY_DAYS,
  LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS,
} from "@nexus/domain";
import { Button } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
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
export async function LibraryMembershipHistoryScreen({
  params,
  searchParams,
}: {
  params?: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const c = libraryCollectionsCopy(locale),
    h = libraryCollectionHistoryCopy(locale),
    m = libraryMembershipHistoryCopy(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{c.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {c.signIn}
        </Link>
      </section>
    );
  try {
    const filters = collectionPageParams(raw);
    if (params) {
      if (filters.size) throw new AppError("Unexpected receipt query", 400, "COLLECTION_INVALID");
      const result = await libraryCollectionsService.membershipReceipt(actor, (await params).id);
      return (
        <div className="mx-auto max-w-5xl space-y-6 py-8">
          <Link href={membershipHistoryHref()} className="text-accent underline">
            {m.history}
          </Link>
          <h1>{m.detail}</h1>
          <p>{m.note}</p>
          <LibraryMembershipHistoryEntry item={result.item} locale={locale} />
          <p>
            <time dateTime={result.generatedAt}>{result.generatedAt}</time>
          </p>
        </div>
      );
    }
    const query = libraryMembershipHistoryQuery(filters),
      result = await libraryCollectionsService.membershipHistory(actor, query);
    const suffix = (page: number) => libraryMembershipHistorySuffix({ ...query, page });
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={m.title}>
          <Link href={collectionHref()} className="text-accent underline">
            {c.title}
          </Link>
          <Link href="/workspace/library/collections/history" className="text-accent underline">
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
          <Link href={membershipHistoryHref()} className="text-accent underline">
            {h.clear}
          </Link>
        </form>
        <p>
          {c.items}: {result.total} ·{" "}
          <time dateTime={result.generatedAt}>{result.generatedAt}</time>
        </p>
        <a
          href={`/api/library/collections/membership-history/export?${suffix(result.page)}`}
          className="text-accent underline"
        >
          {h.export}
        </a>
        {!result.items.length && <p>{m.empty}</p>}
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
                className="text-accent underline"
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
                className="text-accent underline"
              >
                {c.next}
              </Link>
            )}
          </nav>
        )}
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    return (
      <section className="mx-auto max-w-xl space-y-4 py-16">
        <p role="alert">{libraryCollectionError(locale, error.code)}</p>
        <Link href={membershipHistoryHref()} className="text-accent underline">
          {c.reload}
        </Link>
      </section>
    );
  }
}
