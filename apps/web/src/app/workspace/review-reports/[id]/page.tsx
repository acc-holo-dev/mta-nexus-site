import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../../lib/resource-review-i18n";
import type { Metadata } from "next";
import { ResourceReviewReportScreen } from "../../../../components/resource-review-report-screen";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).reports} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return ResourceReviewReportScreen({ staff: false, id: (await params).id });
}
