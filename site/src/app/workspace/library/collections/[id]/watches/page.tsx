import type { Metadata } from "next";
import { CollectionWatchesScreen } from "../../../../../../features/library/collection-watches-server";
import { resourceReleaseWatchesCopy } from "../../../../../../features/resources/resource-release-watches-i18n";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReleaseWatchesCopy(await getRequestLocale()).collectionTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return CollectionWatchesScreen(props);
}
