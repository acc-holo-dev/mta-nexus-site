import {
  ResourceReviewReportScreen,
  resourceReviewReportMetadata,
} from "../../../../../features/resources/review-report-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceReviewReportMetadata;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return ResourceReviewReportScreen({ staff: true, id: (await params).id });
}
