import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { verificationCopy } from "../../../features/trust/verification-workspace-copy";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/verification.
export default async function Loading() {
  const copy = verificationCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="verification-loading-heading"
      title={copy.title}
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
