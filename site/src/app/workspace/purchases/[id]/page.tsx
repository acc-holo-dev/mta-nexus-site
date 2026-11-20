import type { Metadata } from "next";
import { getCommerceHistoryCopy } from "../../../../features/commerce/commerce-history-i18n";
import { PurchaseDetailScreen } from "../../../../features/commerce/purchase-detail-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getCommerceHistoryCopy(await getRequestLocale()).orderDetailsTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return (
    <div className={pageShellClass}>{await PurchaseDetailScreen({ params, searchParams })}</div>
  );
}
