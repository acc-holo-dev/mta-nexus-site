import { collectionCommandItemResults } from "@nexus/domain";
import Link from "next/link";
import { libraryCollectionHistoryCopy } from "../lib/library-collection-history-i18n";
import {
  collectionReceiptHref,
  libraryCollectionReceiptsCopy,
} from "../lib/library-collection-receipts-i18n";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
  collectionsQuery,
} from "../lib/library-collections-query";
import { libraryCollectionsService as service } from "../lib/services/library-collections-service";
import {
  LibraryCollectionsPagination,
  type LibraryCollectionsActor,
  type LibraryCollectionsQuery,
  libraryCollectionsLinkClass,
} from "./library-collections-screen-shared";

export async function LibraryCollectionsHistoryView({
  locale,
  actor,
  id,
  queryValues,
}: {
  locale: "ru" | "en";
  actor: LibraryCollectionsActor;
  id: string;
  queryValues: LibraryCollectionsQuery;
}) {
  const c = libraryCollectionsCopy(locale);
  const query = collectionsQuery(collectionPageParams(queryValues), "history");
  const result = await service.history(actor, id, query.page);
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href={collectionHref(id)} className={libraryCollectionsLinkClass}>
        {c.back}
      </Link>
      <h1 className="font-display text-primary">
        {c.history}: {result.collection.name}
      </h1>
      <Link
        href={`/workspace/library/collections/history?${new URLSearchParams({ collectionId: id })}`}
        className={libraryCollectionsLinkClass}
      >
        {libraryCollectionHistoryCopy(locale).title}
      </Link>
      {!result.items.length && (
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {c.emptyHistory}
        </p>
      )}
      <ol className="space-y-4">
        {result.items.map((item) => (
          <li key={item.id} className="nexus-panel space-y-2 p-4">
            <Link href={collectionReceiptHref(item.id)} className={libraryCollectionsLinkClass}>
              {libraryCollectionReceiptsCopy(locale).open}
            </Link>
            <h2 className="font-semibold">
              {c[item.command.action]} · {c.revision} {item.collection.revision}
            </h2>
            <p className="break-words">
              {item.collection.name} · {c[item.collection.status]}
            </p>
            {item.command.action === "duplicate" && (
              <p className="break-all text-sm">
                {c.source}: {item.command.sourceCollectionId} · {c.revision}:{" "}
                {item.command.expectedRevision} · {c.items}: {item.command.expectedItemCount}
              </p>
            )}
            {(item.command.action === "copy-items" || item.command.action === "move-items") && (
              <p className="break-all text-sm">
                {c.source}: {item.command.sourceCollectionId} · {c.revision}:{" "}
                {item.command.expectedSourceRevision}
              </p>
            )}
            {item.sourceCollection && (
              <p className="break-all text-sm">
                {c.sourceSuccessor}: {item.sourceCollection.id} · {item.sourceCollection.revision}
              </p>
            )}
            {item.command.action === "move-items" && (
              <p className="break-all text-sm">
                {c.destination}: {item.collection.id} · {c.revision} {item.collection.revision}
              </p>
            )}
            {item.command.action === "reconcile-items" && (
              <div>
                <p>
                  {c.add}: {item.command.addProductIds.join(", ") || "—"}
                </p>
                <p>
                  {c.remove}: {item.command.removeProductIds.join(", ") || "—"}
                </p>
              </div>
            )}
            {(() => {
              const results = collectionCommandItemResults(item.command);
              if (!results.length) {
                return (
                  <>
                    {"productIds" in item.command && (
                      <ul className="space-y-1 text-sm">
                        {item.command.productIds.map((productId) => (
                          <li key={productId} className="break-all">
                            {productId}
                          </li>
                        ))}
                      </ul>
                    )}
                    {"productId" in item.command && (
                      <p className="break-all text-sm">{item.command.productId}</p>
                    )}
                  </>
                );
              }
              const outcomeLabel = {
                added: c.add,
                removed: c.remove,
                copied: c["copy-items"],
                moved: c["move-items"],
              } as const;
              return (
                <ul className="space-y-1 text-sm">
                  {results.map((entry) => (
                    <li key={`${entry.outcome}:${entry.productId}`} className="break-all">
                      {outcomeLabel[entry.outcome]}: {entry.productId} · {c.batchApplied}
                    </li>
                  ))}
                </ul>
              );
            })()}
            <p className="text-sm">
              {c.created}:{" "}
              <time dateTime={item.createdAt.toISOString()}>{item.createdAt.toISOString()}</time>
            </p>
            <p className="break-all text-xs text-muted">
              {c.receipt}: {item.id} · {c.request}: {item.requestId}
            </p>
          </li>
        ))}
      </ol>
      <LibraryCollectionsPagination
        bounds={result}
        locale={locale}
        href={(nextPage) => collectionHref(id, "history", { page: String(nextPage) })}
      />
      <a
        href={`/api/library/collections/${encodeURIComponent(id)}/history?page=${result.page}`}
        className={`text-sm ${libraryCollectionsLinkClass}`}
      >
        {c.json}
      </a>
    </div>
  );
}
