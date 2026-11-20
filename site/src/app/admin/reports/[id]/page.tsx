import {
  CommunityReportScreen,
  communityReportMetadata,
} from "../../../../features/community/reports-server";

export const dynamic = "force-dynamic";

export const generateMetadata = communityReportMetadata;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CommunityReportScreen staff id={(await params).id} />;
}
