import type { Metadata } from "next";
import { AcquisitionReceiptDetailScreen } from "../../../../../features/resources/acquisition-receipt-detail-server";
import { resourceCartReceiptsCopy } from "../../../../../features/resources/resource-cart-receipts-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCartReceiptsCopy(await getRequestLocale()).receipt} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return AcquisitionReceiptDetailScreen({ params });
}
