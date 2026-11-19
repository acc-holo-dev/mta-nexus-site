import type { Metadata } from "next";
import { LibraryWatchesScreen } from "../../../../features/library/library-watches-server";
import { resourceReleaseWatchesCopy } from "../../../../features/resources/resource-release-watches-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReleaseWatchesCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LibraryWatchesScreen(props);
}
