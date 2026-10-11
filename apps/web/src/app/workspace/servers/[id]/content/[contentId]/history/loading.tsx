import { authorPublicationDeskCopy } from "../../../../../../../lib/author-publication-desk-copy";
import { getRequestLocale } from "../../../../../../../lib/i18n-server";
export default async function Loading() {
  return (
    <p role="status" className="nexus-panel p-5 text-muted">
      {authorPublicationDeskCopy(await getRequestLocale()).loading}
    </p>
  );
}
