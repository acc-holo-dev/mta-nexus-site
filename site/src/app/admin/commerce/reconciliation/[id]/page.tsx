import type { Metadata } from "next";
import { getFinancialCopy } from "../../../../../features/commerce/financial-i18n";
import { FinancialReconciliationDetailScreen } from "../../../../../features/commerce/financial-reconciliation-detail-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getFinancialCopy(await getRequestLocale()).evidenceDocumentTitle} | MTA NEXUS`,
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
  return FinancialReconciliationDetailScreen({ params, searchParams });
}
