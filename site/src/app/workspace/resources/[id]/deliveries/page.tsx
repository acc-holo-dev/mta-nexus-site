import type { Metadata } from "next";
import { PublisherDeliveriesScreen } from "../../../../../features/resources/publisher-deliveries-server";
import { resourceDeliveriesCopy } from "../../../../../features/resources/resource-deliveries-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).publisherTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function PublisherDeliveriesPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PublisherDeliveriesScreen(props);
}
