import type { Metadata } from "next";
import { getCommercialCopy } from "../../features/commerce/commercial-i18n";
import { PublicSubscriptionsScreen } from "../../features/commerce/public-subscriptions-server";
import { getRequestLocale } from "../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).catalog} | MTA NEXUS`,
  };
}

export default async function Page(props: {
  searchParams: Promise<{ scope?: string | string[]; page?: string | string[] }>;
}) {
  return PublicSubscriptionsScreen(props);
}
