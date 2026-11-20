import type { Metadata } from "next";
import { getCommercialCopy } from "../../../../features/commerce/commercial-i18n";
import { CommercialPlansAdminScreen } from "../../../../features/commerce/commercial-plans-admin-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).admin} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>;
}) {
  return CommercialPlansAdminScreen({ searchParams });
}
