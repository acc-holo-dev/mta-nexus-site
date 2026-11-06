import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import {
  collectionId,
  collectionPageParams,
  collectionsQuery,
} from "../lib/library-collections-query";
import { librarySelectionBatchesCopy } from "../lib/library-selection-batches-i18n";
import { authService } from "../lib/services/auth-service";
import { libraryCollectionsService } from "../lib/services/library-collections-service";
import { librarySelectionBatchesService } from "../lib/services/library-selection-batches-service";
import { LibrarySelectionBatchControls } from "./library-selection-batch-controls";
import { PlatformSignIn } from "./platform-sign-in";
export async function LibrarySelectionBatchScreen({
  params,
  searchParams,
  history = false,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  history?: boolean;
}) {
  const [locale, store, path, raw] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const dictionary = getDictionary(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  const c = librarySelectionBatchesCopy(locale),
    cc = libraryCollectionsCopy(locale);
  const idForGuest = encodeURIComponent(path.id);
  const versionsBase = `/workspace/library/collections/${idForGuest}/versions${history ? "/history" : ""}`;
  if (!actor) {
    let returnPath = versionsBase;
    try {
      const preview = collectionsQuery(collectionPageParams(raw), history ? "history" : "detail");
      returnPath = `${versionsBase}?${new URLSearchParams({ page: String(preview.page) })}`;
    } catch {
      // Keep the versions route when pagination is invalid for guests.
    }
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  const loadFailure = (retryHref: string) => (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
      <ErrorState
        id="library-selection-batch-unavailable"
        title={c.loadUnavailable}
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
  try {
    const id = collectionId(path.id),
      query = collectionsQuery(collectionPageParams(raw), history ? "history" : "detail"),
      base = `/workspace/library/collections/${encodeURIComponent(id)}/versions`,
      retryHref = `${base}${history ? "/history" : ""}?${new URLSearchParams({ page: String(query.page), ...(query.q ? { q: query.q } : {}) })}`;
    if (history) {
      const result = await librarySelectionBatchesService
        .history(actor, id, query.page)
        .catch((error: unknown) => {
          if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
          return null;
        });
      if (!result) return loadFailure(retryHref);
      return (
        <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
          <Link
            href={base}
            className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {c.title}
          </Link>
          <h1 className="font-display">
            {c.history}: {result.collection.name}
          </h1>
          <p>{c.privacy}</p>
          {!result.items.length && <EmptyState title={c.empty} description={c.privacy} />}
          <ol className="space-y-4">
            {result.items.map((receipt) => (
              <li key={receipt.id} className="nexus-panel space-y-3 p-4">
                <h2>
                  {c[receipt.snapshot.mode]} · {c.changed}:{" "}
                  {
                    receipt.snapshot.items.filter((i) => i.previous.revision !== i.next.revision)
                      .length
                  }
                </h2>
                <p>
                  {c.revision}: {receipt.snapshot.collectionRevision} ·{" "}
                  <time dateTime={receipt.createdAt.toISOString()}>
                    {receipt.createdAt.toISOString()}
                  </time>
                </p>
                <p className="break-all text-xs">
                  {c.receipt}: {receipt.id} · {c.request}: {receipt.requestId}
                </p>
                <details>
                  <summary>{c.preview}</summary>
                  <ul className="space-y-2 pt-3">
                    {receipt.snapshot.items.map((item) => (
                      <li key={item.productId} className="break-all text-sm">
                        <code>{item.productId}</code>
                        <p>
                          {c.previous}: {c[item.previous.mode]} · {item.previous.buildId ?? "—"} ·{" "}
                          {c.selectionRevision}: {item.previous.revision}
                        </p>
                        <p>
                          {c.next}: {c[item.next.mode]} · {item.next.buildId ?? "—"} ·{" "}
                          {c.selectionRevision}: {item.next.revision}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
          <nav aria-label={cc.page} className="flex gap-4">
            {result.page > 1 && (
              <Link href={`${base}/history?page=${result.page - 1}`}>{cc.previous}</Link>
            )}
            <span>
              {cc.page} {result.page} {cc.of} {result.totalPages}
            </span>
            {result.page < result.totalPages && (
              <Link href={`${base}/history?page=${result.page + 1}`}>{cc.next}</Link>
            )}
          </nav>
          <a
            href={`/api/library/collections/${encodeURIComponent(id)}/versions/history/export?page=${result.page}`}
            className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {c.export}
          </a>
        </div>
      );
    }
    const result = await libraryCollectionsService
      .detail(actor, id, query)
      .catch((error: unknown) => {
        if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
        return null;
      });
    if (!result) return loadFailure(retryHref);
    const pageHref = (page: number) =>
      `${base}?${new URLSearchParams({ page: String(page), ...(result.q ? { q: result.q } : {}) })}`;
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link
          href={`/workspace/library/collections/${encodeURIComponent(id)}`}
          className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {c.back}
        </Link>
        <h1 className="font-display">
          {c.title}: {result.collection.name}
        </h1>
        <Link
          href={`${base}/history`}
          className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {c.history}
        </Link>
        {result.collection.status === "archived" ? (
          <p role="note">{c.archived}</p>
        ) : (
          <LibrarySelectionBatchControls
            collectionId={id}
            locale={locale}
            key={`${id}:${result.collection.revision}:${result.page}:${result.q}`}
            items={result.items.map(({ productId, title, downloadable, hasAccess }) => ({
              productId,
              title,
              downloadable,
              hasAccess,
            }))}
          />
        )}
        <nav aria-label={cc.page} className="flex gap-4">
          {result.page > 1 && (
            <Link
              href={pageHref(result.page - 1)}
              className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {cc.previous}
            </Link>
          )}
          <span>
            {cc.page} {result.page} {cc.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link
              href={pageHref(result.page + 1)}
              className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {cc.next}
            </Link>
          )}
        </nav>
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
    const retryHref = versionsBase;
    return loadFailure(retryHref);
  }
}
