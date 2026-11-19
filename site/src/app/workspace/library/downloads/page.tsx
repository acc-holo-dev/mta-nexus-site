import type { Metadata } from "next";
import { LibraryDownloadsScreen } from "../../../../features/library/library-downloads-server";
import { resourceDeliveriesCopy } from "../../../../features/resources/resource-deliveries-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function ResourceDownloadsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LibraryDownloadsScreen(props);
}
