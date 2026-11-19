import type { Metadata } from "next";
import { LibraryDownloadDetailPage } from "../../../../../features/library/library-download-detail-server";
import { resourceDeliveriesCopy } from "../../../../../features/resources/resource-deliveries-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).receipt} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function DownloadReceiptPage(props: { params: Promise<{ id: string }> }) {
  return LibraryDownloadDetailPage(props);
}
