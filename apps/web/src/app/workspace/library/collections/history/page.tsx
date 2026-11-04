import {
  AppError,
  LIBRARY_COLLECTION_HISTORY_ACTIONS,
  LIBRARY_COLLECTION_HISTORY_DAYS,
} from "@nexus/domain";
import { Button, EmptyState, ErrorState, Input } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { libraryCollectionHistoryCopy } from "../../../../../lib/library-collection-history-i18n";
import {
  libraryCollectionHistoryQuery,
  libraryCollectionHistorySuffix,
} from "../../../../../lib/library-collection-history-query";
import {
  collectionReceiptHref,
  libraryCollectionReceiptsCopy,
} from "../../../../../lib/library-collection-receipts-i18n";
import {
  libraryCollectionError,
  libraryCollectionsCopy,
} from "../../../../../lib/library-collections-i18n";
import { collectionHref, collectionPageParams } from "../../../../../lib/library-collections-query";
import { libraryMembershipHistoryCopy } from "../../../../../lib/library-membership-history-i18n";
import { membershipHistoryHref } from "../../../../../lib/library-membership-history-query";
import { authService } from "../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const selectClass =
  "min-h-11 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const labelClass = "block font-label uppercase text-secondary";

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
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const c = libraryCollectionsCopy(typedLocale),
    h = libraryCollectionHistoryCopy(typedLocale),
    dictionary = getDictionary(typedLocale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) {
    let returnPath = "/workspace/library/collections/history";
    try {
      const query = libraryCollectionHistoryQuery(collectionPageParams(raw));
      returnPath = `${returnPath}?${libraryCollectionHistorySuffix(query)}`;
    } catch {
      // Keep the list route when filters are invalid for unsigned visitors.
    }
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }
  try {
    const query = libraryCollectionHistoryQuery(collectionPageParams(raw));
    const retryHref = `/workspace/library/collections/history?${libraryCollectionHistorySuffix(query)}`;
    const result = await libraryCollectionsService
      .accountHistory(actor, query)
      .catch((error: unknown) => {
        if (error instanceof AppError) throw error;
        return null;
      });
    if (!result) {
      return (
        <div className={pageShellClass}>
          <ErrorState
            title={h.loadUnavailable}
            description={h.loadUnavailableDescription}
            action={
              <Link href={retryHref} className={navLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    const suffix = (page: number) => libraryCollectionHistorySuffix({ ...query, page });
    const filtered =
      result.action !== "all" ||
      Boolean(result.collectionId) ||
      Boolean(result.productId) ||
      result.days !== 30;
    return (
      <div className={pageShellClass}>
        <nav className="flex min-w-0 flex-wrap gap-4 text-sm" aria-label={h.title}>
          <Link href={membershipHistoryHref()} className={navLinkClass}>
            {libraryMembershipHistoryCopy(typedLocale).history}
          </Link>
          <Link href={collectionHref()} className={navLinkClass}>
            {c.title}
          </Link>
          <Link href="/workspace/library" className={navLinkClass}>
            {c.library}
          </Link>
        </nav>
        <h1 className="min-w-0 break-words font-display">{h.title}</h1>
        <p className="text-secondary">{h.note}</p>
        <form
          method="get"
          action="/workspace/library/collections/history"
          className="nexus-panel flex min-w-0 flex-wrap items-end gap-4 overflow-x-clip p-4"
        >
          <label className="min-w-0 flex-1 space-y-1.5 text-sm text-secondary">
            <span className={labelClass}>{h.days}</span>
            <select name="days" defaultValue={result.days} className={selectClass}>
              {LIBRARY_COLLECTION_HISTORY_DAYS.map((days) => (
                <option key={days} value={days}>
                  {days}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 flex-1 space-y-1.5 text-sm text-secondary">
            <span className={labelClass}>{h.action}</span>
            <select name="action" defaultValue={result.action} className={selectClass}>
              {LIBRARY_COLLECTION_HISTORY_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {c[action]}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-0 flex-1">
            <Input
              name="collectionId"
              defaultValue={result.collectionId ?? ""}
              maxLength={160}
              pattern="[A-Za-z0-9_-]+"
              label={h.collectionId}
            />
          </div>
          <div className="min-w-0 flex-1">
            <Input
              name="productId"
              defaultValue={result.productId ?? ""}
              maxLength={160}
              pattern="[A-Za-z0-9_-]+"
              label={h.productId}
            />
          </div>
          <Button type="submit" variant="secondary" size="touch">
            {h.filter}
          </Button>
          <Link href="/workspace/library/collections/history" className={navLinkClass}>
            {h.clear}
          </Link>
        </form>
        <p className="text-sm text-muted">
          {c.items}: {result.total} ·{" "}
          <time dateTime={result.generatedAt}>{result.generatedAt}</time>
        </p>
        <a
          href={`/api/library/collections/history/export?${suffix(result.page)}`}
          className={navLinkClass}
        >
          {h.export}
        </a>
        {!result.items.length ? (
          <EmptyState
            title={h.empty}
            description={h.emptyHint}
            action={
              filtered ? (
                <Link href="/workspace/library/collections/history" className={navLinkClass}>
                  {h.clear}
                </Link>
              ) : undefined
            }
          />
        ) : null}
        <ol className="min-w-0 space-y-4 overflow-x-clip">
          {result.items.map((item) => {
            const receipt = item.receipt,
              command = receipt?.command;
            return (
              <li key={item.id} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
                <Link href={collectionReceiptHref(item.id)} className={navLinkClass}>
                  {libraryCollectionReceiptsCopy(typedLocale).open}
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
                          className={navLinkClass}
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
                        <Link href={collectionHref(item.currentSource.id)} className={navLinkClass}>
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
                  <ul className="min-w-0 space-y-2 overflow-x-clip">
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
                            className={navLinkClass}
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
          <nav aria-label={c.page} className="flex min-w-0 flex-wrap gap-4 text-sm">
            {result.page > 1 && (
              <Link
                href={`/workspace/library/collections/history?${suffix(result.page - 1)}`}
                className={navLinkClass}
              >
                {c.previous}
              </Link>
            )}
            <span className="inline-flex min-h-11 items-center">
              {c.page} {result.page} {c.of} {result.totalPages}
            </span>
            {result.page < result.totalPages && (
              <Link
                href={`/workspace/library/collections/history?${suffix(result.page + 1)}`}
                className={navLinkClass}
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
      <section className={pageShellClass}>
        <ErrorState
          title={libraryCollectionError(typedLocale, error.code)}
          description={h.loadUnavailableDescription}
          action={
            <Link href="/workspace/library/collections/history" className={navLinkClass}>
              {c.reload}
            </Link>
          }
        />
      </section>
    );
  }
}
