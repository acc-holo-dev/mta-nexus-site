import type { Metadata } from "next";
import { AcquisitionReceiptsScreen } from "../../../../features/resources/acquisition-receipts-server";
import { resourceCartReceiptsCopy } from "../../../../features/resources/resource-cart-receipts-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCartReceiptsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return AcquisitionReceiptsScreen({ searchParams });
}
