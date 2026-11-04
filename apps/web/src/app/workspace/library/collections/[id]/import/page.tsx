import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryCollectionImport } from "../../../../../../components/library-collection-import";
import { PlatformSignIn } from "../../../../../../components/platform-sign-in";
import { getDictionary } from "../../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { libraryCollectionManifestsCopy } from "../../../../../../lib/library-collection-manifests-i18n";
import {
  libraryCollectionError,
  libraryCollectionsCopy,
} from "../../../../../../lib/library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
} from "../../../../../../lib/library-collections-query";
import { authService } from "../../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionManifestsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, { id }, raw] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const c = libraryCollectionsCopy(typedLocale),
    m = libraryCollectionManifestsCopy(typedLocale),
    dictionary = getDictionary(typedLocale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return <PlatformSignIn locale={typedLocale} returnPath={collectionHref(id, "import")} />;
  try {
    if (collectionPageParams(raw).size)
      throw new AppError("Unexpected import query", 400, "COLLECTION_INVALID");
    const collectionId = (await params).id;
    const manifest = await libraryCollectionsService
      .exportManifest(actor, collectionId)
      .catch((error: unknown) => {
        if (error instanceof AppError) throw error;
        return null;
      });
    if (!manifest) {
      return (
        <div className={pageShellClass}>
          <ErrorState
            title={m.loadUnavailable}
            description={m.loadUnavailableDescription}
            action={
              <Link href={collectionHref(id, "import")} className={navLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    const collection = manifest.collection;
    return (
      <div className={pageShellClass}>
        <nav className="flex min-w-0 flex-wrap gap-4">
          <Link href={collectionHref(collection.id)} className={navLinkClass}>
            {c.back}
          </Link>
          <a
            href={`/api/library/collections/${encodeURIComponent(collection.id)}/export`}
            className={navLinkClass}
          >
            {m.export}
          </a>
        </nav>
        <h1 className="min-w-0 break-words">
          {m.title}: {collection.name}
        </h1>
        <p>
          {c[collection.status]} · {c.revision} {collection.revision} · {c.items}:{" "}
          {manifest.productIds.length}
        </p>
        {collection.status === "archived" && <p>{c.archivedNote}</p>}
        {collection.revision >= 2147483647 && <p>{c.revisionLocked}</p>}
        <LibraryCollectionImport key={collection.id} collection={collection} locale={typedLocale} />
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    return (
      <section className={pageShellClass}>
        <ErrorState
          title={libraryCollectionError(typedLocale, error.code)}
          description={m.loadUnavailableDescription}
          action={
            <Link href={collectionHref()} className={navLinkClass}>
              {c.reload}
            </Link>
          }
        />
      </section>
    );
  }
}
