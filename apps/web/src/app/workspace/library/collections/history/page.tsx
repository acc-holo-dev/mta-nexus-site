import {
  collectionReceiptHref,
  libraryCollectionReceiptsCopy,
} from "../../../../../lib/library-collection-receipts-i18n";
import { libraryMembershipHistoryCopy } from "../../../../../lib/library-membership-history-i18n";
import { membershipHistoryHref } from "../../../../../lib/library-membership-history-query";
import {
  AppError,
  LIBRARY_COLLECTION_HISTORY_ACTIONS,
  LIBRARY_COLLECTION_HISTORY_DAYS,
} from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { libraryCollectionHistoryCopy } from "../../../../../lib/library-collection-history-i18n";
import {
  libraryCollectionHistoryQuery,
  libraryCollectionHistorySuffix,
} from "../../../../../lib/library-collection-history-query";
import {
  libraryCollectionsCopy,
  libraryCollectionError,
} from "../../../../../lib/library-collections-i18n";
import { collectionHref, collectionPageParams } from "../../../../../lib/library-collections-query";
import { authService } from "../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionHistoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const c = libraryCollectionsCopy(locale),
    h = libraryCollectionHistoryCopy(locale),
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
    const query = libraryCollectionHistoryQuery(collectionPageParams(raw));
    const result = await libraryCollectionsService.accountHistory(actor, query);
    const suffix = (page: number) => libraryCollectionHistorySuffix({ ...query, page });
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={h.title}>
          <Link href={membershipHistoryHref()} className="text-accent underline">
            {libraryMembershipHistoryCopy(locale).history}
          </Link>
          <Link href={collectionHref()} className="text-accent underline">
            {c.title}
          </Link>
          <Link href="/workspace/library" className="text-accent underline">
            {c.library}
          </Link>
        </nav>
        <h1 className="font-display">{h.title}</h1>
        <p className="text-secondary">{h.note}</p>
        <form
          method="get"
          action="/workspace/library/collections/history"
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
              name="action"
              defaultValue={result.action}
              className="rounded border border-base bg-surface p-2"
            >
              {LIBRARY_COLLECTION_HISTORY_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {c[action]}
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
          <button type="submit" className="rounded border border-base px-3 py-2">
            {h.filter}
          </button>
          <Link href="/workspace/library/collections/history" className="text-accent underline">
            {h.clear}
          </Link>
        </form>
        <p className="text-sm text-muted">
          {c.items}: {result.total} ·{" "}
          <time dateTime={result.generatedAt}>{result.generatedAt}</time>
        </p>
        <a
          href={`/api/library/collections/history/export?${suffix(result.page)}`}
          className="text-accent underline"
        >
          {h.export}
        </a>
        {!result.items.length && <p>{h.empty}</p>}
        <ol className="space-y-4">
          {result.items.map((item) => {
            const receipt = item.receipt,
              command = receipt?.command;
            return (
              <li key={item.id} className="nexus-panel space-y-3 p-5">
                <Link href={collectionReceiptHref(item.id)} className="text-accent underline">
                  {libraryCollectionReceiptsCopy(locale).open}
                </Link>
                <h2 className="font-semibold">{command ? c[command.action] : h.unknown}</h2>
                <p className="text-sm">
                  {h.time}: <time dateTime={item.createdAt}>{item.createdAt}</time>
                </p>
                <p className="break-all text-xs text-muted">
                  {c.receipt}: {item.id}
                  {receipt ? ` · ${c.request}: ${receipt.requestId}` : ""}
                </p>
                {receipt && (
                  <>
                    <p className="break-words">
                      {h.recorded}: {receipt.collection.name} · {c[receipt.collection.status]} ·{" "}
                      {c.revision} {receipt.collection.revision}
                    </p>
                    <code className="block break-all text-xs">{receipt.collection.id}</code>
                    {item.currentCollection ? (
                      <p className="break-words">
                        {h.current}:{" "}
                        <Link
                          href={collectionHref(item.currentCollection.id)}
                          className="text-accent underline"
                        >
                          {item.currentCollection.name}
                        </Link>{" "}
                        · {c[item.currentCollection.status]} · {c.revision}{" "}
                        {item.currentCollection.revision}
                      </p>
                    ) : (
                      <p className="text-muted">{h.noCurrent}</p>
                    )}
                    {command && "sourceCollectionId" in command && (
                      <p className="break-all text-sm">
                        {c.source}: {command.sourceCollectionId} · {c.revision}{" "}
                        {"expectedSourceRevision" in command
                          ? command.expectedSourceRevision
                          : command.expectedRevision}
                      </p>
                    )}
                    {item.currentSource && (
                      <p className="break-words text-sm">
                        {h.sourceCurrent}:{" "}
                        <Link
                          href={collectionHref(item.currentSource.id)}
                          className="text-accent underline"
                        >
                          {item.currentSource.name}
                        </Link>{" "}
                        · {c[item.currentSource.status]} · {c.revision}{" "}
                        {item.currentSource.revision}
                      </p>
                    )}
                    {receipt.sourceCollection && (
                      <p className="break-all text-sm">
                        {c.sourceSuccessor}: {receipt.sourceCollection.id} ·{" "}
                        {receipt.sourceCollection.revision}
                      </p>
                    )}
                    {command?.action === "reconcile-items" && (
                      <div>
                        <p>
                          {c.add}: {command.addProductIds.join(", ") || "—"}
                        </p>
                        <p>
                          {c.remove}: {command.removeProductIds.join(", ") || "—"}
                        </p>
                      </div>
                    )}
                    {command?.action === "duplicate" && (
                      <>
                        <p>
                          {c.items}: {command.expectedItemCount}
                        </p>
                        <p className="text-sm text-muted">{h.fullCopy}</p>
                      </>
                    )}
                  </>
                )}
                {item.resources.length > 0 && (
                  <ul className="space-y-2">
                    {item.resources.map((resource) => (
                      <li key={resource.productId} className="space-y-1 border-t border-base pt-2">
                        <p className="break-words">
                          {resource.currentAvailable
                            ? (resource.currentTitle ?? c.unavailable)
                            : h.unavailable}
                        </p>
                        <code className="block break-all text-xs">{resource.productId}</code>
                        {resource.currentAvailable && (
                          <Link
                            href={`/workspace/library/${encodeURIComponent(resource.productId)}/collections`}
                            className="text-sm text-accent underline"
                          >
                            {c.resourceCollections}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        {result.totalPages > 1 && (
          <nav aria-label={c.page} className="flex flex-wrap gap-4 text-sm">
            {result.page > 1 && (
              <Link
                href={`/workspace/library/collections/history?${suffix(result.page - 1)}`}
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
                href={`/workspace/library/collections/history?${suffix(result.page + 1)}`}
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
        <Link href="/workspace/library/collections/history" className="text-accent underline">
          {c.reload}
        </Link>
      </section>
    );
  }
}
