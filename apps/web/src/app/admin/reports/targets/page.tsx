import {
  CommunityReportGroupsPage,
  reportGroupsMetadata,
} from "../../../../components/community-report-groups-page";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const generateMetadata = reportGroupsMetadata;
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <CommunityReportGroupsPage searchParams={searchParams} />
    </div>
  );
}
