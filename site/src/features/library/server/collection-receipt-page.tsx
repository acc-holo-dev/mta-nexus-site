import { AppError, collectionCommandProductIds } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { formatUnknown } from "../../../lib/i18n/unknown";
import { authService } from "../../../lib/services/accounts/auth-service";
import { libraryCollectionsService } from "../../../lib/services/library/library-collections-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass, pageShellStack3 } from "../../shell/page-shell";
import { panelClipSpace2P4, panelClipSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeBreakAllXs, typeFlexMinWrapGap4, typeMinBreakWords } from "../../shell/type-shell";
import { LibraryCollectionRestoreControls } from "../collection-restore";
import {
  collectionReceiptHref,
  libraryCollectionReceiptsCopy,
} from "../library-collection-receipts-i18n";
import { libraryCollectionError, libraryCollectionsCopy } from "../library-collections-i18n";
import { collectionHref, collectionPageParams } from "../library-collections-query";
export async function collectionReceiptMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionReceiptsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export async function CollectionReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, { id }, raw] = await Promise.all([getRequestLocale(), params, searchParams]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const c = libraryCollectionsCopy(typedLocale),
    r = libraryCollectionReceiptsCopy(typedLocale),
    dictionary = getDictionary(typedLocale);
  const safeReturn = /^[A-Za-z0-9_-]{1,160}$/u.test(id)
    ? collectionReceiptHref(id)
    : "/workspace/library/collections/history";
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={r.title}
        message={r.loadUnavailable}
        retryHref={safeReturn}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={typedLocale} returnPath={safeReturn} />;
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
          <h1 className="font-display">{r.title}</h1>
          <ErrorState
            title={r.loadUnavailable}
            description={r.loadUnavailableDescription}
            action={
              <Link href={collectionReceiptHref(id)} className={linkAccentSmRounded}>
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
        <nav className={typeFlexMinWrapGap4}>
          <Link href="/workspace/library/collections/history" className={linkAccentSmRounded}>
            {c.history}
          </Link>
          <Link href={collectionHref()} className={linkAccentSmRounded}>
            {c.title}
          </Link>
        </nav>
        <h1 className={typeMinBreakWords}>{r.title}</h1>
        <p>{r.note}</p>
        <code className={typeBreakAllXs}>
          {c.receipt}: {report.id}
        </code>
        <p>
          {r.time}: <time dateTime={report.createdAt}>{report.createdAt}</time>
        </p>
        <a
          href={`/api/library/collections/receipts/${encodeURIComponent(report.id)}/export`}
          className={linkAccentSmRounded}
        >
          {r.export}
        </a>
        {!receipt ? (
          <EmptyState title={r.unknown} description={r.unknownHint} />
        ) : (
          <article className={panelClipSpace3P5}>
            <h2>{c[receipt.command.action]}</h2>
            <code className={typeBreakAllXs}>
              {c.request}: {receipt.requestId}
            </code>
            <p>
              {r.recorded}: {receipt.collection.name} · {c[receipt.collection.status]} ·{" "}
              {c.revision} {receipt.collection.revision}
            </p>
            <code className={typeBreakAllXs}>{receipt.collection.id}</code>
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
                  className={linkAccentSmRounded}
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
                  {c.add}: {formatUnknown(typedLocale, receipt.command.addProductIds.join(", "))}
                </p>
                <p>
                  {c.remove}:{" "}
                  {formatUnknown(typedLocale, receipt.command.removeProductIds.join(", "))}
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
          <ul className={pageShellStack3}>
            {report.resources.map((resource) => (
              <li key={resource.productId} className={panelClipSpace2P4}>
                <p>
                  {resource.currentAvailable
                    ? (resource.currentTitle ?? c.unavailable)
                    : c.unavailable}
                </p>
                <code className={typeBreakAllXs}>{resource.productId}</code>
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
            <Link href={collectionHref()} className={linkAccentSmRounded}>
              {c.reload}
            </Link>
          }
        />
      </section>
    );
  }
}
