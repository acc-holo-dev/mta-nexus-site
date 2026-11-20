import type { Metadata } from "next";
import { getResourceReleaseControlCopy } from "../../../../features/library/resource-release-control-i18n";
import { StaffResourceDetailScreen } from "../../../../features/resources/staff-resource-detail-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceReleaseControlCopy(await getRequestLocale()).decisionDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function ResourceModerationDetail(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return StaffResourceDetailScreen(props);
}
