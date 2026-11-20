import type { Metadata } from "next";
import { getCommerceHistoryCopy } from "../../../features/commerce/commerce-history-i18n";
import { PurchasesHistoryScreen } from "../../../features/commerce/purchases-history-server";
import { getRequestLocale } from "../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getCommerceHistoryCopy(await getRequestLocale()).purchasesTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return <div className={pageShellClass}>{await PurchasesHistoryScreen({ searchParams })}</div>;
}
