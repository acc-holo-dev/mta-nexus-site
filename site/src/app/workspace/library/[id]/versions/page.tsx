import type { Metadata } from "next";
import { LibraryVersionsScreen } from "../../../../../features/library/library-versions-server";
import { getResourceReleaseControlCopy } from "../../../../../features/library/resource-release-control-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceReleaseControlCopy(await getRequestLocale()).versions} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function LibraryVersionsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return LibraryVersionsScreen(props);
}
