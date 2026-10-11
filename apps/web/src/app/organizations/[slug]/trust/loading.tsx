import { getRequestLocale } from "../../../../lib/i18n-server";
import { contextTrustCopy } from "../../../../lib/public-context-trust-copy";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-6 text-sm text-muted">
      {contextTrustCopy(await getRequestLocale()).loading}
    </p>
  );
}
