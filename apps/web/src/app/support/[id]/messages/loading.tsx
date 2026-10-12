import { getRequestLocale } from "../../../../lib/i18n-server";
import { supportMessageCopy } from "../../../../lib/support-message-discovery-copy";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-5 text-muted">
      {supportMessageCopy(await getRequestLocale()).loading}
    </p>
  );
}
