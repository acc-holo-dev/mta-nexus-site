import { resourceReleaseWatchesCopy } from "../lib/resource-release-watches-i18n";
import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { collectionReleasesCopy } from "../lib/collection-releases-i18n";
import { collectionRequirementsCopy } from "../lib/collection-requirements-i18n";
import { librarySelectionBatchesCopy } from "../lib/library-selection-batches-i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import {
  collectionHref,
  collectionId,
  collectionPageParams,
  collectionsQuery,
} from "../lib/library-collections-query";
import { authService } from "../lib/services/auth-service";
import { libraryCollectionsService as service } from "../lib/services/library-collections-service";
import { LibraryCollectionItemCopyForm } from "./library-collection-item-copy";
import { LibraryCollectionBatchForm } from "./library-collection-batch";
import { LibraryCollectionCommandForm } from "./library-collection-command";
import { ResourceDownloadButton } from "./resource-download-button";

type Query = Record<string, string | string[] | undefined>;
type Bounds = { page: number; totalPages: number; total: number };
function Pagination({
  bounds,
  locale,
  href,
}: {
  bounds: Bounds;
  locale: "ru" | "en";
  href: (page: number) => string;
}) {
  const c = libraryCollectionsCopy(locale);
  return (
    <nav aria-label={c.page} className="flex flex-wrap gap-4 text-sm">
      {bounds.page > 1 && (
        <Link href={href(bounds.page - 1)} className="text-accent underline">
          {c.previous}
        </Link>
      )}
      <span>
        {c.page} {bounds.page} {c.of} {bounds.totalPages}
      </span>
      {bounds.page < bounds.totalPages && (
        <Link href={href(bounds.page + 1)} className="text-accent underline">
          {c.next}
        </Link>
      )}
    </nav>
  );
}
export async function LibraryCollectionsScreen({
  view = "list",
  searchParams,
  params,
}: {
  view?: "list" | "detail" | "add" | "history" | "copy" | "copy-items" | "move-items";
  searchParams: Promise<Query>;
  params?: Promise<{ id: string }>;
}) {
  const [locale, store, queryValues, path] = await Promise.all([
    getRequestLocale(),
    cookies(),
    searchParams,
    params,
  ]);
  const c = libraryCollectionsCopy(locale),
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
    if (view === "copy" && collectionPageParams(queryValues).size)
      throw new AppError("Unexpected copy query", 400, "COLLECTION_INVALID");
    const query = collectionsQuery(
      collectionPageParams(queryValues),
      view === "list" ? "list" : view === "history" ? "history" : "detail",
    );
    if (view === "list") {
      const result = await service.page(actor, query);
      return (
        <div className="mx-auto max-w-4xl space-y-6 py-8">
          <Link href="/workspace/library" className="text-accent underline">
            {c.library}
          </Link>
          <h1 className="font-display text-primary">{c.title}</h1>
          <p className="text-sm text-secondary">{c.subtitle}</p>
          <p role="note" className="text-sm text-muted">
            {c.limit}
          </p>
          <section className="nexus-panel space-y-3 p-5">
            <h2 className="font-semibold">{c.create}</h2>
            <LibraryCollectionCommandForm locale={locale} />
          </section>
          <nav aria-label={c.title} className="flex gap-4">
            {(["active", "archived", "all"] as const).map((status) => (
              <Link
                key={status}
                href={collectionHref(undefined, "", { status })}
                aria-current={result.status === status ? "page" : undefined}
                className="text-accent underline aria-[current=page]:font-bold"
              >
                {c[status]}
              </Link>
            ))}
          </nav>
          {!result.items.length && <p>{c.empty}</p>}
          <ol className="grid gap-4 sm:grid-cols-2">
            {result.items.map((item) => (
              <li key={item.id} className="nexus-panel space-y-2 p-5">
                <h2 className="break-words font-semibold">
                  <Link href={collectionHref(item.id)} className="text-accent underline">
                    {item.name}
                  </Link>
                </h2>
                <p className="text-sm">
                  {c[item.status]} · {c.items}: {item.itemCount} · {c.revision}: {item.revision}
                </p>
              </li>
            ))}
          </ol>
          <Pagination
            bounds={result}
            locale={locale}
            href={(page) =>
              collectionHref(undefined, "", { status: result.status, page: String(page) })
            }
          />
          <a
            href={`/api/library/collections?${new URLSearchParams({ status: result.status, page: String(result.page) })}`}
            className="text-sm text-accent underline"
          >
            {c.json}
          </a>
        </div>
      );
    }
    const id = collectionId(path?.id ?? "");
    if (view === "copy-items" || view === "move-items") {
      const result = await service.copyItemsPage(actor, id, query);
      return (
        <div className="mx-auto max-w-4xl space-y-6 py-8">
          <Link href={collectionHref(id)} className="text-accent underline">
            {c.back}
          </Link>
          <h1 className="font-display">{c[view]}</h1>
          <p className="break-words">
            {c.source}: {result.source.name} · {c[result.source.status]} · {c.revision}{" "}
            {result.source.revision}
          </p>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1">
              {c.search}
              <input
                name="q"
                defaultValue={result.q}
                maxLength={80}
                className="rounded border border-base bg-inset px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded border border-base px-4 py-2">
              {c.apply}
            </button>
          </form>
          <LibraryCollectionItemCopyForm
            key={JSON.stringify([
              view,
              result.source,
              result.items.map((item) => item.productId),
              result.destinations,
            ])}
            move={view === "move-items"}
            locale={locale}
            source={result.source}
            items={result.items}
            destinations={result.destinations}
          />
          <Pagination
            bounds={result}
            locale={locale}
            href={(page) =>
              collectionHref(id, view, {
                page: String(page),
                ...(result.q ? { q: result.q } : {}),
              })
            }
          />
          <a
            href={`/api/library/collections/${encodeURIComponent(id)}/${view}?${new URLSearchParams({ page: String(result.page), ...(result.q ? { q: result.q } : {}) })}`}
            className="text-accent underline"
          >
            {c.json}
          </a>
        </div>
      );
    }
    if (view === "copy") {
      const preview = await service.copyPreview(actor, id);
      return (
        <div className="mx-auto max-w-2xl space-y-6 py-8">
          <Link href={collectionHref(id)} className="text-accent underline">
            {c.back}
          </Link>
          <h1 className="font-display">{c.duplicate}</h1>
          <p className="break-words">
            {c.source}: {preview.source.name}
          </p>
          <p>
            {c[preview.source.status]} · {c.revision}: {preview.source.revision} · {c.items}:{" "}
            {preview.itemCount}
          </p>
          <p role="note" className="text-sm text-secondary">
            {c.copyNote}
          </p>
          <p className="text-sm text-muted">{c.limit}</p>
          <LibraryCollectionCommandForm
            key={`copy:${id}:${preview.source.revision}:${preview.sourceDigest}`}
            locale={locale}
            collection={preview.source}
            copyPreview={preview}
            action="duplicate"
          />
          <a
            href={`/api/library/collections/${encodeURIComponent(id)}/copy`}
            className="text-sm text-accent underline"
          >
            {c.json}
          </a>
        </div>
      );
    }
    if (view === "history") {
      const result = await service.history(actor, id, query.page);
      return (
        <div className="mx-auto max-w-4xl space-y-6 py-8">
          <Link href={collectionHref(id)} className="text-accent underline">
            {c.back}
          </Link>
          <h1 className="font-display text-primary">
            {c.history}: {result.collection.name}
          </h1>
          <ol className="space-y-4">
            {result.items.map((item) => (
              <li key={item.id} className="nexus-panel space-y-2 p-4">
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
                    {c.sourceSuccessor}: {item.sourceCollection.id} ·{" "}
                    {item.sourceCollection.revision}
                  </p>
                )}
                {item.command.action === "move-items" && (
                  <p className="break-all text-sm">
                    {c.destination}: {item.collection.id} · {c.revision} {item.collection.revision}
                  </p>
                )}
                {"productIds" in item.command && (
                  <ul className="space-y-1 text-sm">
                    {item.command.productIds.map((id) => (
                      <li key={id} className="break-all">
                        {id}
                      </li>
                    ))}
                  </ul>
                )}
                {"productId" in item.command && (
                  <p className="break-all text-sm">{item.command.productId}</p>
                )}
                <p className="text-sm">
                  {c.created}:{" "}
                  <time dateTime={item.createdAt.toISOString()}>
                    {item.createdAt.toISOString()}
                  </time>
                </p>
                <p className="break-all text-xs text-muted">
                  {c.receipt}: {item.id} · {c.request}: {item.requestId}
                </p>
              </li>
            ))}
          </ol>
          <Pagination
            bounds={result}
            locale={locale}
            href={(page) => collectionHref(id, "history", { page: String(page) })}
          />
          <a
            href={`/api/library/collections/${encodeURIComponent(id)}/history?page=${result.page}`}
            className="text-sm text-accent underline"
          >
            {c.json}
          </a>
        </div>
      );
    }
    const adding = view === "add",
      result = await service.detail(actor, id, query, adding),
      collection = result.collection;
    const snapshot = {
      id: collection.id,
      name: collection.name,
      status: collection.status,
      revision: collection.revision,
    };
    const href = (page: number) =>
      collectionHref(id, adding ? "add" : "", {
        page: String(page),
        ...(result.q ? { q: result.q } : {}),
      });
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <Link
          href={adding ? collectionHref(id) : collectionHref()}
          className="text-accent underline"
        >
          {adding ? c.back : c.title}
        </Link>
        <h1 className="break-words font-display text-primary">
          {collection.name}
          {adding ? ` · ${c.candidates}` : ""}
        </h1>
        <p className="text-sm">
          {c[collection.status]} · {c.revision} {collection.revision}
        </p>
        <p role="note" className="text-sm text-secondary">
          {c.subtitle}
        </p>
        {collection.status === "archived" && (
          <p role="note" className="rounded border border-base p-4">
            {c.archivedNote}
          </p>
        )}
        {!adding && (
          <>
            <Link
              href={`/workspace/library/collections/${encodeURIComponent(id)}/watches`}
              className="text-accent underline"
            >
              {resourceReleaseWatchesCopy(locale).collectionTitle}
            </Link>
            <Link href={collectionHref(id, "releases")} className="text-accent underline">
              {collectionReleasesCopy(locale).title}
            </Link>
          </>
        )}
        {!adding && (
          <Link href={`${collectionHref(id)}/versions`} className="text-accent underline">
            {librarySelectionBatchesCopy(locale).title}
          </Link>
        )}
        {!adding && (
          <Link href={`${collectionHref(id)}/requirements`} className="text-accent underline">
            {collectionRequirementsCopy(locale).title}
          </Link>
        )}
        {!adding && (
          <section className="nexus-panel grid gap-5 p-5 sm:grid-cols-2">
            {collection.status === "active" ? (
              <>
                <LibraryCollectionCommandForm
                  key={`rename:${collection.revision}`}
                  locale={locale}
                  collection={snapshot}
                  action="rename"
                />
                <LibraryCollectionCommandForm
                  key={`archive:${collection.revision}`}
                  locale={locale}
                  collection={snapshot}
                  action="archive"
                />
              </>
            ) : (
              <LibraryCollectionCommandForm
                key={`restore:${collection.revision}`}
                locale={locale}
                collection={snapshot}
                action="restore"
              />
            )}
          </section>
        )}
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={c.title}>
          {!adding && collection.status === "active" && (
            <Link href={collectionHref(id, "add")} className="text-accent underline">
              {c.candidates}
            </Link>
          )}
          <Link href={collectionHref(id, "copy")} className="text-accent underline">
            {c.duplicate}
          </Link>
          {collection.status === "active" && (
            <Link href={collectionHref(id, "move-items")} className="text-accent underline">
              {c["move-items"]}
            </Link>
          )}
          <Link href={collectionHref(id, "copy-items")} className="text-accent underline">
            {c["copy-items"]}
          </Link>
          <Link href={collectionHref(id, "history")} className="text-accent underline">
            {c.history}
          </Link>
        </nav>
        <form
          method="get"
          action={collectionHref(id, adding ? "add" : "")}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="space-y-1">
            <span className="block text-sm">{c.search}</span>
            <input
              name="q"
              defaultValue={result.q}
              maxLength={80}
              className="rounded border border-base bg-surface p-2"
            />
          </label>
          <button type="submit" className="rounded border border-base px-3 py-2 text-sm">
            {c.apply}
          </button>
          {result.q && (
            <Link
              href={collectionHref(id, adding ? "add" : "")}
              className="text-sm text-accent underline"
            >
              {c.clear}
            </Link>
          )}
        </form>
        <p className="text-sm">
          {c.items}: {result.total} · {c.ready}: {result.ready}
        </p>
        {!result.items.length && <p>{c.emptyItems}</p>}
        {collection.status === "active" && result.items.length > 0 && (
          <LibraryCollectionBatchForm
            key={`batch:${collection.revision}:${adding}:${result.page}:${result.q}`}
            locale={locale}
            collection={snapshot}
            action={adding ? "add-many" : "remove-many"}
            items={result.items.filter((item) => !adding || !item.inCollection)}
          />
        )}
        <ol className="grid gap-4 md:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.productId} className="nexus-panel space-y-3 p-5">
              <h2 className="break-words font-semibold">{item.title ?? c.unavailable}</h2>
              {item.downloadable && item.version ? (
                <ResourceDownloadButton
                  productId={item.productId}
                  version={item.version}
                  buildId={item.buildId ?? undefined}
                />
              ) : (
                <p className="text-sm text-muted">{c.unavailableNote}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                <Link
                  href={`/workspace/library/${encodeURIComponent(item.productId)}/collections`}
                  className="text-accent underline"
                >
                  {c.resourceCollections}
                </Link>
                {item.slug && (
                  <Link
                    href={`/market/${encodeURIComponent(item.slug)}`}
                    className="text-accent underline"
                  >
                    {c.open}
                  </Link>
                )}
                {item.hasAccess && (
                  <Link
                    href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                    className="text-accent underline"
                  >
                    {c.versions}
                  </Link>
                )}
              </div>
              {collection.status === "active" &&
                (adding && item.inCollection ? (
                  <p role="status" className="text-sm text-muted">
                    {c.inCollection}
                  </p>
                ) : (
                  <LibraryCollectionCommandForm
                    key={`${collection.revision}:${item.productId}`}
                    locale={locale}
                    collection={snapshot}
                    productId={item.productId}
                    action={adding ? "add" : "remove"}
                  />
                ))}
            </li>
          ))}
        </ol>
        <Pagination bounds={result} locale={locale} href={href} />
        <a
          href={`/api/library/collections/${encodeURIComponent(id)}${adding ? "/candidates" : ""}?${new URLSearchParams({ page: String(result.page), ...(result.q ? { q: result.q } : {}) })}`}
          className="text-sm text-accent underline"
        >
          {c.json}
        </a>
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    if (error.code === "COLLECTION_ARCHIVED" && path?.id) redirect(collectionHref(path.id));
    return (
      <section className="mx-auto max-w-xl space-y-4 py-16">
        <p role="alert">{libraryCollectionError(locale, error.code)}</p>
        <Link href={collectionHref()} className="text-accent underline">
          {c.title}
        </Link>
      </section>
    );
  }
}
