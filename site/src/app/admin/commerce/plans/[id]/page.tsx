import type { Metadata } from "next";
import { getCommercialCopy } from "../../../../../features/commerce/commercial-i18n";
import { CommercialPlanAdminDetailScreen } from "../../../../../features/commerce/commercial-plan-admin-detail-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).versionsDocumentTitle} | MTA NEXUS`,
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
  return CommercialPlanAdminDetailScreen({ params, searchParams });
}
