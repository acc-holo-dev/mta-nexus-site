import {
  CommunityReportScreen,
  communityReportMetadata,
} from "../../../../features/community/reports-server";

export const dynamic = "force-dynamic";
export const generateMetadata = communityReportMetadata;
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return <CommunityReportScreen id={(await params).id} />;
}
