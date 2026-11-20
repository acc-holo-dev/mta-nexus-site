import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceDeliveriesService } from "../../../lib/services/commerce/resource-deliveries-service";
import { ResourceDeliveryEvidence } from "../../resources/delivery-server";
import { ResourceDownloadButton } from "../../resources/download";
import { resourceDeliveriesCopy } from "../../resources/resource-deliveries-i18n";
import {
  resourceDeliveriesUrl,
  resourceDeliveryId,
} from "../../resources/resource-deliveries-query";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax3xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeDisplayPrimary, typeSmMuted, typeSmSecondary } from "../../shell/type-shell";
import { SupportDownloadHelpLink } from "../../support/download-help";
export async function libraryDownloadDetailMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).receipt} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LibraryDownloadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]),
    copy = resourceDeliveriesCopy(locale),
    dictionary = getDictionary(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/workspace/library/downloads/"}
      />
    );
  }

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
        <Link href="/workspace/library/downloads" className={linkAccentSm}>
          {copy.title}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link
              href={`/workspace/library/downloads/${encodeURIComponent(id)}`}
              className={linkAccentSm}
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
      <Link href="/workspace/library/downloads" className={linkAccentSm}>
        {copy.title}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.receipt}</h1>
      <h2 className="break-words text-xl text-primary">{receipt.title ?? copy.privateResource}</h2>
      <p role="note" className={typeSmSecondary}>
        {copy.note}
      </p>
      <p>{copy[receipt.status]}</p>
      <ResourceDeliveryEvidence receipt={receipt} locale={locale} />
      <p className={typeSmMuted}>{receipt.pinned ? copy.fixed : copy.latest}</p>
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
        <ErrorState
          id="library-download-receipt-unavailable"
          title={copy.unavailable}
          description={copy.unavailableHint}
        />
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
        className={linkAccentSm}
      >
        {copy.history}
      </Link>
    </div>
  );
}
