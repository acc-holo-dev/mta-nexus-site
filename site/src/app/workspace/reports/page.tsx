import {
  CommunityReportScreen,
  communityReportListMetadata,
} from "../../../features/community/reports-server";

export const dynamic = "force-dynamic";
export const generateMetadata = communityReportListMetadata;
export default function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CommunityReportScreen searchParams={searchParams} />;
}
