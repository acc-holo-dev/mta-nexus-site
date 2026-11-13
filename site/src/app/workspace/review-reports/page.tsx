import type { Metadata } from "next";
import { ResourceReviewReportScreen } from "../../../components/resource-review-report-screen";
import { getRequestLocale } from "../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../lib/resource-review-i18n";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  return {
    title: `${resourceReviewCopy(typedLocale).reports} | MTA NEXUS`,
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
      {await ResourceReviewReportScreen({ staff: false, query: await searchParams })}
    </div>
  );
}
