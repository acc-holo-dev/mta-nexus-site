import { CommunityReportScreen } from "../../../components/community-report-screen";
import { communityReportCopy } from "../../../lib/community-report-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: communityReportCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CommunityReportScreen searchParams={searchParams} />;
}
