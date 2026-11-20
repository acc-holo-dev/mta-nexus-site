import type { Metadata } from "next";
import { getFinancialCopy } from "../../../../features/commerce/financial-i18n";
import { FinancialReconciliationScreen } from "../../../../features/commerce/financial-reconciliation-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getFinancialCopy(await getRequestLocale()).review} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; filter?: string | string[] }>;
}) {
  return FinancialReconciliationScreen({ searchParams });
}
