import { reportGroupsCopy } from "../../../../../features/community/community-report-groups-copy";
import { HonestLoadingShell } from "../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = reportGroupsCopy(locale);
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headingId="admin-publication-reports-loading-heading"
      title={copy.publicationTitle}
      loadingLabel={copy.publicationLoading}
      titleClassName="text-2xl font-extrabold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
