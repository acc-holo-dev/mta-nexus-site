import type { Metadata } from "next";
import { CommunityReportScreen } from "../../../components/community-report-screen";
import { communityReportCopy } from "../../../lib/community-report-copy";
import { getRequestLocale } from "../../../lib/i18n-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  return {
    title: communityReportCopy(typedLocale).title,
    robots: { index: false, follow: false },
  };
}
export default function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <CommunityReportScreen searchParams={searchParams} />
    </div>
  );
}
