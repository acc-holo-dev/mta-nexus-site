import type { Metadata } from "next";
import { LibraryWatchHistoryScreen } from "../../../../../features/library/library-watch-history-server";
import { resourceReleaseWatchHistoryCopy } from "../../../../../features/resources/resource-release-watch-history-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReleaseWatchHistoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LibraryWatchHistoryScreen(props);
}
