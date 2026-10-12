import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryCollectionCommandForm } from "../../../../../components/library-collection-command";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import {
  libraryCollectionError,
  libraryCollectionsCopy,
} from "../../../../../lib/library-collections-i18n";
import { collectionHref, collectionPageParams } from "../../../../../lib/library-collections-query";
import { authService } from "../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";

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
    if (collectionPageParams(query).size)
      throw new AppError("Unexpected resource collections query", 400, "COLLECTION_INVALID");
    const result = await libraryCollectionsService.resourceMemberships(actor, id);
    const href = `/workspace/library/${encodeURIComponent(id)}/collections`;
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8">
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={c.library}>
          <Link href="/workspace/library" className="text-accent underline">
            {c.library}
          </Link>
          <Link href={collectionHref()} className="text-accent underline">
            {c.title}
          </Link>
          {result.resource.available && (
            <Link
              href={`/workspace/library/${encodeURIComponent(id)}/versions`}
              className="text-accent underline"
            >
              {c.versions}
            </Link>
          )}
        </nav>
        <h1 className="font-display text-primary">{c.resourceCollections}</h1>
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
        {!result.collections.length && <p>{c.empty}</p>}
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
                  <Link href={collectionHref(collection.id)} className="text-accent underline">
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
        <a
          href={`/api/library/${encodeURIComponent(id)}/collections`}
          className="text-sm text-accent underline"
        >
          {c.json}
        </a>
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
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
