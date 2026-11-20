import type { Metadata } from "next";
import { getCommercialCopy } from "../../../../../features/commerce/commercial-i18n";
import { PurchaseOperationsScreen } from "../../../../../features/commerce/purchase-operations-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).paymentOperations} | MTA NEXUS`,
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
    <div className={pageShellClass}>{await PurchaseOperationsScreen({ params, searchParams })}</div>
  );
}
