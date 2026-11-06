import { AppError, collectionCommandProductIds } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryCollectionRestoreControls } from "../../../../../../components/library-collection-restore";
import { PlatformSignIn } from "../../../../../../components/platform-sign-in";
import { getDictionary } from "../../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import {
  collectionReceiptHref,
  libraryCollectionReceiptsCopy,
} from "../../../../../../lib/library-collection-receipts-i18n";
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
  const [locale, store, { id }, raw] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const c = libraryCollectionsCopy(typedLocale),
    r = libraryCollectionReceiptsCopy(typedLocale),
    dictionary = getDictionary(typedLocale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={typedLocale} returnPath={collectionReceiptHref(id)} />;
  try {
    if (collectionPageParams(raw).size)
      throw new AppError("Unexpected receipt query", 400, "COLLECTION_INVALID");
    const receiptId = (await params).id;
    const report = await libraryCollectionsService
      .receiptDetail(actor, receiptId)
      .catch((error: unknown) => {
        if (error instanceof AppError) throw error;
        return null;
      });
    if (!report) {
      return (
        <div className={pageShellClass}>
          <ErrorState
            id="library-collection-receipt-load-unavailable"
            title={r.loadUnavailable}
            description={r.loadUnavailableDescription}
            action={
              <Link href={collectionReceiptHref(id)} className={navLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    const receipt = report.receipt;
    return (
      <div className={pageShellClass}>
        <nav className="flex min-w-0 flex-wrap gap-4">
          <Link href="/workspace/library/collections/history" className={navLinkClass}>
            {c.history}
          </Link>
          <Link href={collectionHref()} className={navLinkClass}>
            {c.title}
          </Link>
        </nav>
        <h1 className="min-w-0 break-words">{r.title}</h1>
        <p>{r.note}</p>
        <code className="block break-all text-xs">
          {c.receipt}: {report.id}
        </code>
        <p>
          {r.time}: <time dateTime={report.createdAt}>{report.createdAt}</time>
        </p>
        <a
          href={`/api/library/collections/receipts/${encodeURIComponent(report.id)}/export`}
          className={navLinkClass}
        >
          {r.export}
        </a>
        {!receipt ? (
          <EmptyState title={r.unknown} description={r.unknownHint} />
        ) : (
          <article className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
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
                <Link href={collectionHref(report.currentCollection.id)} className={navLinkClass}>
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
                  {collectionCommandProductIds(receipt.command).map((productId) => (
                    <li key={productId}>
                      <code className="break-all text-xs">{productId}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>
        )}
        {report.resources.length > 0 && (
          <ul className="min-w-0 space-y-3 overflow-x-clip">
            {report.resources.map((resource) => (
              <li
                key={resource.productId}
                className="nexus-panel min-w-0 space-y-2 overflow-x-clip p-4"
              >
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
            locale={typedLocale}
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
      <section className={pageShellClass}>
        <ErrorState
          title={libraryCollectionError(typedLocale, error.code)}
          description={r.loadUnavailableDescription}
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
