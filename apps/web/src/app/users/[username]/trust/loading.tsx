import { getRequestLocale } from "../../../../lib/i18n-server";
import { trustCopy } from "../../../../lib/public-user-trust-copy";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-6 text-sm text-muted">
      {trustCopy(await getRequestLocale()).loading}
    </p>
  );
}
