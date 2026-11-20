import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceCartReceiptsService } from "../../../lib/services/commerce/resource-cart-receipts-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { ResourceCartReviewEvidence } from "../cart-view";
import { ResourceDownloadButton } from "../download";
import { resourceCartReceiptsCopy } from "../resource-cart-receipts-i18n";
import { resourceCartReceiptId } from "../resource-cart-receipts-query";
import { pageShellMax4xl } from "../../shell/page-shell";

const linkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function acquisitionReceiptDetailMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCartReceiptsCopy(await getRequestLocale()).receipt} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function AcquisitionReceiptDetailScreen({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]),
    copy = resourceCartReceiptsCopy(locale);
  const dictionary = getDictionary(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/workspace/acquisitions/receipts/"}
      />
    );
  }

  const returnPath = `/workspace/acquisitions/receipts/${encodeURIComponent(id)}`;
  if (!user) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let requestId: string;
  try {
    requestId = resourceCartReceiptId(id);
  } catch {
    notFound();
  }
  const receipt = await resourceCartReceiptsService.detail(user, requestId).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  if (!receipt) {
    return (
      <div className={pageShellMax4xl}>
        <Link href="/workspace/acquisitions/receipts" className={linkClass}>
          {copy.title}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnPath} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellMax4xl}>
      <Link href="/workspace/acquisitions/receipts" className={linkClass}>
        {copy.title}
      </Link>
      <h1 className="font-display text-primary">{copy.receipt}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.note}
      </p>
      <p className="break-all font-mono text-xs text-muted">{receipt.requestId}</p>
      <p>
        {copy.date}:{" "}
        <time dateTime={receipt.createdAt.toISOString()}>
          {formatHistoryDate(receipt.createdAt, locale)}
        </time>
      </p>
      {!receipt.reviewed ? (
        <div className="nexus-panel space-y-3 p-5">
          <p>{copy.legacyNote}</p>
          <p>
            {copy.items}: {receipt.legacyProductCount}
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {receipt.items.map((item) => (
            <li key={item.productId} className="nexus-panel space-y-4 p-5">
              <h2 className="break-words text-lg font-semibold">{item.title}</h2>
              <p className="text-sm text-secondary">
                {item.alreadyClaimed ? copy.alreadyOwned : copy.newlyAdded} ·{" "}
                {copy[item.accessSource]}
              </p>
              <ResourceCartReviewEvidence item={item} locale={locale} />
              <p className="text-sm">
                {copy.term}:{" "}
                {item.recordedExpiresAt
                  ? formatHistoryDate(new Date(item.recordedExpiresAt), locale)
                  : copy.unknownTerm}
              </p>
              {item.downloadable ? (
                <div className="space-y-3">
                  <p className="text-sm">{copy.download}</p>
                  <ResourceDownloadButton
                    productId={item.productId}
                    buildId={item.buildId}
                    version={item.version}
                  />
                </div>
              ) : (
                <ErrorState
                  title={item.hasCurrentAccess ? copy.unavailable : copy.removed}
                  description={item.hasCurrentAccess ? copy.unavailableHint : copy.removedHint}
                />
              )}
              {item.downloadable ? (
                <Link
                  href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                  className={linkClass}
                  prefetch={false}
                >
                  {copy.versions}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <Link href="/workspace/library" className={linkClass}>
        {copy.library}
      </Link>
    </div>
  );
}
