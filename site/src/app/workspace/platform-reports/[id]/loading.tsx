import { platformReportCopy } from "../../../../lib/platform-report-i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";

export default async function PlatformReportDetailLoading() {
  const locale = await getRequestLocale();
  const copy = platformReportCopy(locale === "ru" ? "ru" : "en");
  return <p className="text-sm text-muted">{copy.loading}</p>;
}
