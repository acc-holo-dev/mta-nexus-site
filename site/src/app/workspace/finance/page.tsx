import type { Metadata } from "next";
import { getFinancialCopy } from "../../../features/commerce/financial-i18n";
import { WorkspaceFinanceScreen } from "../../../features/commerce/workspace-finance-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getFinancialCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    currency?: string | string[];
    organizationId?: string | string[];
    scopePage?: string | string[];
  }>;
}) {
  return WorkspaceFinanceScreen({ searchParams });
}
