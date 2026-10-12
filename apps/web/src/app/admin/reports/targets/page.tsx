import {
  CommunityReportGroupsPage,
  reportGroupsMetadata,
} from "../../../../components/community-report-groups-page";
export const dynamic = "force-dynamic";
export const generateMetadata = reportGroupsMetadata;
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CommunityReportGroupsPage searchParams={searchParams} />;
}
