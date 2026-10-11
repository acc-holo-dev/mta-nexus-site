import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceDeliveriesService } from "../../../../../lib/services/resource-deliveries-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceDeliveriesCopy } from "../../../../../lib/resource-deliveries-i18n";
import {
  resourceDeliveryId,
  resourceDeliveriesUrl,
} from "../../../../../lib/resource-deliveries-query";
import { ResourceDownloadButton } from "../../../../../components/resource-download-button";
import { ResourceDeliveryEvidence } from "../../../../../components/resource-delivery-evidence";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).receipt} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function DownloadReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]),
    copy = resourceDeliveriesCopy(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  let receiptId: string;
  try {
    receiptId = resourceDeliveryId(id);
  } catch {
    notFound();
  }
  const receipt = await resourceDeliveriesService.detail(user, receiptId).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    throw error;
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-8">
      <Link href="/workspace/library/downloads" className="text-sm text-accent underline">
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
        <p>{copy.unavailable}</p>
      )}
      <Link
        href={resourceDeliveriesUrl({
          page: 1,
          days: "all",
          status: "all",
          resourceId: receipt.resourceId,
        })}
        className="text-sm text-accent underline"
      >
        {copy.history}
      </Link>
    </div>
  );
}
