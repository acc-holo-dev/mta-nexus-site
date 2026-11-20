import type { Metadata } from "next";
import { getResourceReleaseControlCopy } from "../../../features/library/resource-release-control-i18n";
import { StaffResourcesScreen } from "../../../features/resources/staff-resources-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceReleaseControlCopy(await getRequestLocale()).moderation} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function ResourceModerationPage(props: {
  searchParams: Promise<{
    page?: string | string[];
    status?: string | string[];
    query?: string | string[];
  }>;
}) {
  return StaffResourcesScreen(props);
}
