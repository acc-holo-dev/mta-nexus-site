import { CommunityReportScreen } from "../../../../components/community-report-screen";
import { communityReportCopy } from "../../../../lib/community-report-copy";
import { getRequestLocale } from "../../../../lib/i18n-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: communityReportCopy(await getRequestLocale()).detail,
    robots: { index: false, follow: false },
  };
}
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className={pageShellClass}>
      <CommunityReportScreen id={(await params).id} />
    </div>
  );
}
