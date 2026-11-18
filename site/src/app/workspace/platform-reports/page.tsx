import type { Metadata } from "next";
import { platformReportCopy } from "../../../features/moderation/platform-report-i18n";
import { PlatformReportsScreen } from "../../../features/moderation/reports-server";
import { getRequestLocale } from "../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: platformReportCopy(locale === "ru" ? "ru" : "en").title,
    robots: { index: false, follow: false },
  };
}

export default function PlatformReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <PlatformReportsScreen searchParams={searchParams} />
    </div>
  );
}
