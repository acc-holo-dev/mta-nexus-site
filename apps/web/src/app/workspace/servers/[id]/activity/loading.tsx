import { getRequestLocale } from "../../../../../lib/i18n-server";
import { serverWorkspaceCopy } from "../../../../../lib/server-workspace-copy";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-5 text-sm text-muted">
      {serverWorkspaceCopy(await getRequestLocale()).busy}
    </p>
  );
}
