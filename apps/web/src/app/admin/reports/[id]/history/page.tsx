import {
  CommunityReportHistoryPage,
  reportHistoryMetadata,
} from "../../../../../components/community-report-history-page";
export const dynamic = "force-dynamic";
export const generateMetadata = reportHistoryMetadata;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CommunityReportHistoryPage id={(await params).id} searchParams={searchParams} staff />;
}
