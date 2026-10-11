import { getRequestLocale } from "../../../../lib/i18n-server";
import { verificationApplicationsCopy } from "../../../../lib/verification-applications-copy";
export default async function Loading() {
  return (
    <p role="status" aria-live="polite" className="nexus-panel p-6 text-sm text-muted">
      {verificationApplicationsCopy(await getRequestLocale()).loading}
    </p>
  );
}
