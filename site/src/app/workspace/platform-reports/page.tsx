import type { Metadata } from "next";
import { PlatformReportsScreen } from "../../../components/platform-reports-screen";
import { getRequestLocale } from "../../../lib/i18n-server";
import { platformReportCopy } from "../../../lib/platform-report-i18n";

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
