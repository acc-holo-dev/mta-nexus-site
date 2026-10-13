import { AppError, collectionCommandProductIds } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryCollectionRestoreControls } from "../../../../../../components/library-collection-restore";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { libraryCollectionReceiptsCopy } from "../../../../../../lib/library-collection-receipts-i18n";
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
    title: `${libraryCollectionReceiptsCopy(await getRequestLocale()).title} | MTA NEXUS`,
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
    r = libraryCollectionReceiptsCopy(locale),
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
      throw new AppError("Unexpected receipt query", 400, "COLLECTION_INVALID");
    const report = await libraryCollectionsService.receiptDetail(actor, (await params).id),
      receipt = report.receipt;
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <nav className="flex flex-wrap gap-4">
          <Link href="/workspace/library/collections/history" className="text-accent underline">
            {c.history}
          </Link>
          <Link href={collectionHref()} className="text-accent underline">
            {c.title}
          </Link>
        </nav>
        <h1>{r.title}</h1>
        <p>{r.note}</p>
        <code className="block break-all text-xs">
          {c.receipt}: {report.id}
        </code>
        <p>
          {r.time}: <time dateTime={report.createdAt}>{report.createdAt}</time>
        </p>
        <a
          href={`/api/library/collections/receipts/${encodeURIComponent(report.id)}/export`}
          className="text-accent underline"
        >
          {r.export}
        </a>
        {!receipt ? (
          <p>{r.unknown}</p>
        ) : (
          <article className="nexus-panel space-y-3 p-5">
            <h2>{c[receipt.command.action]}</h2>
            <code className="block break-all text-xs">
              {c.request}: {receipt.requestId}
            </code>
            <p>
              {r.recorded}: {receipt.collection.name} · {c[receipt.collection.status]} ·{" "}
              {c.revision} {receipt.collection.revision}
            </p>
            <code className="block break-all text-xs">{receipt.collection.id}</code>
            {"expectedRevision" in receipt.command && (
              <p>
                {c.revision}: {receipt.command.expectedRevision}
              </p>
            )}
            {"sourceCollectionId" in receipt.command && (
              <p className="break-all">
                {c.source}: {receipt.command.sourceCollectionId} · {c.revision}{" "}
                {"expectedSourceRevision" in receipt.command
                  ? receipt.command.expectedSourceRevision
                  : receipt.command.expectedRevision}
              </p>
            )}
            {receipt.sourceCollection && (
              <p className="break-all">
                {c.sourceSuccessor}: {receipt.sourceCollection.id} · {c.revision}{" "}
                {receipt.sourceCollection.revision}
              </p>
            )}
            {receipt.command.action === "duplicate" && (
              <p>
                {c.items}: {receipt.command.expectedItemCount}
              </p>
            )}
            {report.currentCollection && (
              <p>
                {r.current}:{" "}
                <Link
                  href={collectionHref(report.currentCollection.id)}
                  className="text-accent underline"
                >
                  {report.currentCollection.name}
                </Link>{" "}
                · {c[report.currentCollection.status]} · {c.revision}{" "}
                {report.currentCollection.revision}
              </p>
            )}
            {receipt.command.action === "reconcile-items" ? (
              <div>
                <p>
                  {c.add}: {receipt.command.addProductIds.join(", ") || "—"}
                </p>
                <p>
                  {c.remove}: {receipt.command.removeProductIds.join(", ") || "—"}
                </p>
              </div>
            ) : (
              <>
                <p>{r.unsupported}</p>
                <ul>
                  {collectionCommandProductIds(receipt.command).map((id) => (
                    <li key={id}>
                      <code className="break-all text-xs">{id}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>
        )}
        {report.resources.length > 0 && (
          <ul className="space-y-3">
            {report.resources.map((resource) => (
              <li key={resource.productId} className="nexus-panel space-y-2 p-4">
                <p>
                  {resource.currentAvailable
                    ? (resource.currentTitle ?? c.unavailable)
                    : c.unavailable}
                </p>
                <code className="block break-all text-xs">{resource.productId}</code>
                <p>
                  {r.expected}:{" "}
                  {resource.restoreAction === "remove" ? c.inCollection : c.notInCollection} ·{" "}
                  {r.currentMember}: {resource.inCollection ? c.inCollection : c.notInCollection}
                </p>
                <p>
                  {r.restoreAction}: {resource.restoreAction === "add" ? c.add : c.remove}
                </p>
                <p>
                  {resource.status === "ready"
                    ? r.ready
                    : resource.status === "already-restored"
                      ? r.already
                      : resource.status === "no-access"
                        ? r.noAccess
                        : r.readOnly}
                </p>
              </li>
            ))}
          </ul>
        )}
        {report.restoration && (
          <LibraryCollectionRestoreControls
            key={report.id}
            preview={report.restoration}
            receiptId={report.id}
            locale={locale}
          />
        )}
        <p className="text-sm text-muted">
          <time dateTime={report.generatedAt}>{report.generatedAt}</time>
        </p>
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
