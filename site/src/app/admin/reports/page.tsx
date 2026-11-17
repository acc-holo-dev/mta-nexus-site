import { communityReportCopy } from "../../../features/community/community-report-copy";
import { CommunityReportScreen } from "../../../features/community/reports-server";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: communityReportCopy(await getRequestLocale()).queue,
    robots: { index: false, follow: false },
  };
}
export default function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <CommunityReportScreen staff searchParams={searchParams} />
    </div>
  );
}
