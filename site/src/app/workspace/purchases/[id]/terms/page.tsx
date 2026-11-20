import type { Metadata } from "next";
import { orderTermsCopy } from "../../../../../features/commerce/order-terms-i18n";
import { PurchaseTermsScreen } from "../../../../../features/commerce/purchase-terms-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${orderTermsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>{await PurchaseTermsScreen({ params, searchParams })}</div>
  );
}
