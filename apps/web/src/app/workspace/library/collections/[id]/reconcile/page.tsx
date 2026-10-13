import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryCollectionImport } from "../../../../../../components/library-collection-import";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { libraryCollectionManifestsCopy } from "../../../../../../lib/library-collection-manifests-i18n";
import {
  libraryCollectionsCopy,
  libraryCollectionError,
} from "../../../../../../lib/library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
} from "../../../../../../lib/library-collections-query";
import { authService } from "../../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionManifestsCopy(await getRequestLocale()).reconcileTitle} | MTA NEXUS`,
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
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const c = libraryCollectionsCopy(locale),
    m = libraryCollectionManifestsCopy(locale),
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
    if (collectionPageParams(raw).size)
      throw new AppError("Unexpected import query", 400, "COLLECTION_INVALID");
    const manifest = await libraryCollectionsService.exportManifest(actor, (await params).id),
      collection = manifest.collection;
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <nav className="flex flex-wrap gap-4">
          <Link href={collectionHref(collection.id)} className="text-accent underline">
            {c.back}
          </Link>
          <a
            href={`/api/library/collections/${encodeURIComponent(collection.id)}/export`}
            className="text-accent underline"
          >
            {m.export}
          </a>
        </nav>
        <h1>
          {m.reconcileTitle}: {collection.name}
        </h1>
        <p>
          {c[collection.status]} · {c.revision} {collection.revision} · {c.items}:{" "}
          {manifest.productIds.length}
        </p>
        {collection.status === "archived" && <p>{c.archivedNote}</p>}
        {collection.revision >= 2147483647 && <p>{c.revisionLocked}</p>}
        <LibraryCollectionImport
          key={`reconcile:${collection.id}`}
          collection={collection}
          locale={locale}
          reconcile
        />
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    return (
      <section className="space-y-4 py-16">
        <p role="alert">{libraryCollectionError(locale, error.code)}</p>
        <Link href={collectionHref()} className="text-accent underline">
          {c.reload}
        </Link>
      </section>
    );
  }
}
