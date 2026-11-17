import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceDeliveryEvidence } from "../../../../../features/resources/delivery-server";
import { ResourceDownloadButton } from "../../../../../features/resources/download";
import { resourceDeliveriesCopy } from "../../../../../features/resources/resource-deliveries-i18n";
import {
  resourceDeliveriesUrl,
  resourceDeliveryId,
} from "../../../../../features/resources/resource-deliveries-query";
import { PlatformSignIn } from "../../../../../features/shell/guest-auth";
import { SupportDownloadHelpLink } from "../../../../../features/support/download-help";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/accounts/auth-service";
import { resourceDeliveriesService } from "../../../../../lib/services/commerce/resource-deliveries-service";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).receipt} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function DownloadReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]),
    copy = resourceDeliveriesCopy(locale),
    dictionary = getDictionary(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/library/downloads/${encodeURIComponent(id)}`}
      />
    );
  let receiptId: string;
  try {
    receiptId = resourceDeliveryId(id);
  } catch {
    notFound();
  }
  const receipt = await resourceDeliveriesService.detail(user, receiptId).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  if (!receipt) {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/library/downloads" className={navLinkClass}>
          {copy.title}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link
              href={`/workspace/library/downloads/${encodeURIComponent(id)}`}
              className={navLinkClass}
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/library/downloads" className={navLinkClass}>
        {copy.title}
      </Link>
      <h1 className="font-display text-primary">{copy.receipt}</h1>
      <h2 className="break-words text-xl text-primary">{receipt.title ?? copy.privateResource}</h2>
      <p role="note" className="text-sm text-secondary">
        {copy.note}
      </p>
      <p>{copy[receipt.status]}</p>
      <ResourceDeliveryEvidence receipt={receipt} locale={locale} />
      <p className="text-sm text-muted">{receipt.pinned ? copy.fixed : copy.latest}</p>
      {receipt.downloadable ? (
        <div className="space-y-2">
          <p>{copy.retry}</p>
          <ResourceDownloadButton
            productId={receipt.resourceId}
            version={receipt.version}
            buildId={receipt.buildId}
          />
        </div>
      ) : (
        <ErrorState id="library-download-receipt-unavailable" title={copy.unavailable} />
      )}
      <SupportDownloadHelpLink
        productId={receipt.resourceId}
        buildId={receipt.buildId}
        receiptId={receiptId}
        label={getDictionary(locale).support.askAboutDownload}
      />
      <Link
        href={resourceDeliveriesUrl({
          page: 1,
          days: "all",
          status: "all",
          resourceId: receipt.resourceId,
        })}
        className={navLinkClass}
      >
        {copy.history}
      </Link>
    </div>
  );
}
