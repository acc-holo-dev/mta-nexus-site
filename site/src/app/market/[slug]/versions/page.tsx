import type { Metadata } from "next";
import { getReleaseHistoryCopy } from "../../../../features/resources/public-release-history";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getReleaseHistoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export { PublicResourceVersionsPage as default } from "../../../../features/resources/versions-server";
