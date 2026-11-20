import {
  ResourceReviewReportScreen,
  resourceReviewReportMetadata,
} from "../../../../features/resources/review-report-server";

export const dynamic = "force-dynamic";
export const generateMetadata = resourceReviewReportMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return await ResourceReviewReportScreen({ staff: true, query: await searchParams });
}
