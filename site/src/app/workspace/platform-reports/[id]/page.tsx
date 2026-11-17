import type { Metadata } from "next";
import { platformReportCopy } from "../../../../features/moderation/platform-report-i18n";
import { PlatformReportsScreen } from "../../../../features/moderation/reports-server";
import { getRequestLocale } from "../../../../lib/i18n-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: platformReportCopy(locale === "ru" ? "ru" : "en").detail,
    robots: { index: false, follow: false },
  };
}

export default async function PlatformReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className={pageShellClass}>
      <PlatformReportsScreen id={(await params).id} />
    </div>
  );
}
