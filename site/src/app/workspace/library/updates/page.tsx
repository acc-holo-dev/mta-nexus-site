import type { Metadata } from "next";
import { LibraryUpdatesScreen } from "../../../../features/library/library-updates-server";
import { getResourceReleaseControlCopy } from "../../../../features/library/resource-release-control-i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceReleaseControlCopy(await getRequestLocale()).updates} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function LibraryUpdatesPage(props: {
  searchParams: Promise<{ filter?: string | string[]; page?: string | string[] }>;
}) {
  return LibraryUpdatesScreen(props);
}
