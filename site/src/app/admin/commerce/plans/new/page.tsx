import type { Metadata } from "next";
import { getCommercialCopy } from "../../../../../features/commerce/commercial-i18n";
import { CommercialPlanCreateScreen } from "../../../../../features/commerce/commercial-plan-create-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).createDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page() {
  return CommercialPlanCreateScreen();
}
