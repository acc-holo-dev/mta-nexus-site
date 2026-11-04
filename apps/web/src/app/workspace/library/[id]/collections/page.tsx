import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryCollectionCommandForm } from "../../../../../components/library-collection-command";
import { LibraryMembershipBatchForm } from "../../../../../components/library-membership-batch";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { libraryCollectionHistoryCopy } from "../../../../../lib/library-collection-history-i18n";
import {
  libraryCollectionError,
  libraryCollectionsCopy,
} from "../../../../../lib/library-collections-i18n";
import { collectionHref, collectionPageParams } from "../../../../../lib/library-collections-query";
import { libraryMembershipHistoryCopy } from "../../../../../lib/library-membership-history-i18n";
import { membershipHistoryHref } from "../../../../../lib/library-membership-history-query";
import { authService } from "../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionsCopy(await getRequestLocale()).resourceCollections} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function ResourceCollectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const c = libraryCollectionsCopy(locale),
    dictionary = getDictionary(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/library/${encodeURIComponent(id)}/collections`}
      />
    );
  try {
    if (collectionPageParams(query).size)
      throw new AppError("Unexpected resource collections query", 400, "COLLECTION_INVALID");
    const result = await libraryCollectionsService.resourceMemberships(actor, id).catch((error) => {
      if (error instanceof AppError) throw error;
      return null;
    });
    if (!result) {
      return (
        <div className={pageShellClass}>
          <Link href={collectionHref()} className={navLinkClass}>
            {c.title}
          </Link>
          <ErrorState
            title={c.loadUnavailable}
            action={
              <Link
                href={`/workspace/library/${encodeURIComponent(id)}/collections`}
                className={navLinkClass}
              >
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    const href = `/workspace/library/${encodeURIComponent(id)}/collections`;
    return (
      <div className={pageShellClass}>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={c.library}>
          <Link href="/workspace/library" className={navLinkClass}>
            {c.library}
          </Link>
          <Link
            href={`${membershipHistoryHref()}?productId=${encodeURIComponent(id)}`}
            className={navLinkClass}
          >
            {libraryMembershipHistoryCopy(locale).history}
          </Link>
          <Link href={collectionHref()} className={navLinkClass}>
            {c.title}
          </Link>
          {result.resource.available && (
            <Link
              href={`/workspace/library/${encodeURIComponent(id)}/versions`}
              className={navLinkClass}
            >
              {c.versions}
            </Link>
          )}
        </nav>
        <h1 className="font-display text-primary">{c.resourceCollections}</h1>
        <Link
          href={`/workspace/library/collections/history?${new URLSearchParams({ productId: id })}`}
          className={navLinkClass}
        >
          {libraryCollectionHistoryCopy(locale).title}
        </Link>
        <h2 className="break-words text-xl">
          {result.resource.available ? (result.resource.title ?? c.unavailable) : c.unavailable}
        </h2>
        <p className="break-all text-xs text-muted">{id}</p>
        <p role="note" className="text-sm text-secondary">
          {c.membershipNote}
        </p>
        <p className="text-sm text-muted">{c.limit}</p>
        {!result.resource.available && (
          <p role="note" className="text-sm text-muted">
            {c.unavailableNote}
          </p>
        )}
        {!result.resource.canAdd && (
          <p role="note" className="text-sm text-muted">
            {c.noAddAccess}
          </p>
        )}
        {!result.collections.length ? (
          <EmptyState
            title={c.empty}
            description={c.emptyHint}
            action={
              <Link href={collectionHref()} className={navLinkClass}>
                {c.title}
              </Link>
            }
          />
        ) : null}
        <LibraryMembershipBatchForm key={id} report={result} locale={locale} />
        <ol className="grid gap-4 sm:grid-cols-2">
          {result.collections.map((collection) => {
            const mutable = collection.status === "active" && collection.revision < 2_147_483_647;
            const action = collection.inCollection ? "remove" : "add";
            const permitted =
              mutable &&
              (collection.inCollection ||
                (result.resource.canAdd && collection.itemCount < result.itemLimit));
            return (
              <li key={collection.id} className="nexus-panel space-y-3 p-5">
                <h3 className="break-words font-semibold">
                  <Link href={collectionHref(collection.id)} className={navLinkClass}>
                    {collection.name}
                  </Link>
                </h3>
                <p className="text-sm">
                  {c[collection.status]} · {c.items}: {collection.itemCount} / {result.itemLimit} ·{" "}
                  {c.revision}: {collection.revision}
                </p>
                <p className="text-sm">
                  {collection.inCollection ? c.inCollection : c.notInCollection}
                </p>
                {permitted ? (
                  <LibraryCollectionCommandForm
                    key={`${id}:${collection.id}:${collection.revision}:${action}`}
                    locale={locale}
                    collection={collection}
                    productId={id}
                    action={action}
                    returnHref={href}
                  />
                ) : collection.status === "archived" ? (
                  <p className="text-sm text-muted">{c.archivedNote}</p>
                ) : !mutable ? (
                  <p className="text-sm text-muted">{c.revisionLocked}</p>
                ) : collection.itemCount >= result.itemLimit ? (
                  <p className="text-sm text-muted">{c.fullCollection}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
        <a href={`/api/library/${encodeURIComponent(id)}/collections`} className={navLinkClass}>
          {c.json}
        </a>
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    return (
      <section className={`${pageShellClass} max-w-xl`}>
        <ErrorState
          title={libraryCollectionError(locale, error.code)}
          action={
            <Link href={collectionHref()} className={navLinkClass}>
              {c.title}
            </Link>
          }
        />
      </section>
    );
  }
}
