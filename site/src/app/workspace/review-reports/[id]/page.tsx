import {
  ResourceReviewReportScreen,
  resourceReviewReportMetadata,
} from "../../../../features/resources/review-report-server";

export const dynamic = "force-dynamic";
export const generateMetadata = resourceReviewReportMetadata;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return await ResourceReviewReportScreen({ staff: false, id: (await params).id });
}
