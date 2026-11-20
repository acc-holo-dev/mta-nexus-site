import type { Metadata } from "next";
import { FinancialReconciliationTermsScreen } from "../../../../../../features/commerce/financial-reconciliation-terms-server";
import { orderTermsCopy } from "../../../../../../features/commerce/order-terms-i18n";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

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
  return FinancialReconciliationTermsScreen({ params, searchParams });
}
