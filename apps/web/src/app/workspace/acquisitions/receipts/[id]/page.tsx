import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceCartReceiptsService } from "../../../../../lib/services/resource-cart-receipts-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceCartReceiptsCopy } from "../../../../../lib/resource-cart-receipts-i18n";
import { resourceCartReceiptId } from "../../../../../lib/resource-cart-receipts-query";
import { formatHistoryDate } from "../../../../../lib/commerce-history-format";
import { ResourceCartReviewEvidence } from "../../../../../components/resource-cart-review-evidence";
import { ResourceDownloadButton } from "../../../../../components/resource-download-button";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCartReceiptsCopy(await getRequestLocale()).receipt} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function ResourceCartReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]),
    copy = resourceCartReceiptsCopy(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  let requestId: string;
  try {
    requestId = resourceCartReceiptId(id);
  } catch {
    notFound();
  }
  const receipt = await resourceCartReceiptsService.detail(user, requestId).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    throw error;
  });
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/workspace/acquisitions/receipts" className="text-sm text-accent underline">
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
                <p className="text-sm text-warning">
                  {item.hasCurrentAccess ? copy.unavailable : copy.removed}
                </p>
              )}
              {item.downloadable ? (
                <Link
                  href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                  className="text-sm text-accent underline"
                  prefetch={false}
                >
                  {copy.versions}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <Link href="/workspace/library" className="text-accent underline">
        {copy.library}
      </Link>
    </div>
  );
}
