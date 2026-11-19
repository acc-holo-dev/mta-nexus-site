import type { Metadata } from "next";
import { LibraryPageScreen } from "../../../features/library/library-page-server";
import { getLibraryCopy } from "../../../features/library/library-view";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getLibraryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function ResourceLibraryPage(props: {
  searchParams: Promise<{
    filter?: string | string[];
    page?: string | string[];
  }>;
}) {
  return LibraryPageScreen(props);
}
