import { verificationApplicationsCopy } from "../../../../features/moderation/verification-applications-copy";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

export default async function Loading() {
  const copy = verificationApplicationsCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      headingId="verification-detail-loading-heading"
      title={copy.detail}
      loadingLabel={copy.loading}
      titleClassName="text-xl font-semibold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-6 w-2/3 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
