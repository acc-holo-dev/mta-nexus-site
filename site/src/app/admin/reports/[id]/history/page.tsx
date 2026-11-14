import {
  CommunityReportHistoryPage,
  reportHistoryMetadata,
} from "../../../../../features/community/report-history-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = reportHistoryMetadata;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <CommunityReportHistoryPage id={(await params).id} searchParams={searchParams} staff />
    </div>
  );
}
