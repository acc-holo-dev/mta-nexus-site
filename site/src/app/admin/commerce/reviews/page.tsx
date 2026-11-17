import type { Metadata } from "next";
import { resourceReviewCopy } from "../../../../features/resources/resource-review-i18n";
import { ResourceReviewReportScreen } from "../../../../features/resources/review-report-server";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).queue} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      {await ResourceReviewReportScreen({ staff: true, query: await searchParams })}
    </div>
  );
}
