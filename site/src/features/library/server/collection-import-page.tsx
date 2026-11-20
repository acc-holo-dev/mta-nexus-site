import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { libraryCollectionsService } from "../../../lib/services/library/library-collections-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { LibraryCollectionImport } from "../collection-import";
import { libraryCollectionManifestsCopy } from "../library-collection-manifests-i18n";
import { libraryCollectionError, libraryCollectionsCopy } from "../library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
  collectionId as parseCollectionId,
} from "../library-collections-query";

export async function collectionImportMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionManifestsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export async function CollectionImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, { id }, raw] = await Promise.all([getRequestLocale(), params, searchParams]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const c = libraryCollectionsCopy(typedLocale),
    m = libraryCollectionManifestsCopy(typedLocale),
    dictionary = getDictionary(typedLocale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    let retryHref = collectionHref();
    try {
      parseCollectionId(id);
      retryHref = collectionHref(id, "import");
    } catch {
      /* Keep the collections list. */
    }
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={m.title}
        message={m.loadUnavailable}
        retryHref={retryHref}
      />
    );
  }
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
          <h1 className="font-display">{m.title}</h1>
          <ErrorState
            title={m.loadUnavailable}
            description={m.loadUnavailableDescription}
            action={
              <Link href={collectionHref(id, "import")} className={linkAccentSmRounded}>
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
          <Link href={collectionHref(collection.id)} className={linkAccentSmRounded}>
            {c.back}
          </Link>
          <a
            href={`/api/library/collections/${encodeURIComponent(collection.id)}/export`}
            className={linkAccentSmRounded}
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
        {collection.revision >= 2147483647 ? (
          <ErrorState
            id="library-collection-import-revision-locked"
            title={c.revisionLocked}
            description={c.revisionLockedHint}
          />
        ) : null}
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
            <Link href={collectionHref()} className={linkAccentSmRounded}>
              {c.reload}
            </Link>
          }
        />
      </section>
    );
  }
}
