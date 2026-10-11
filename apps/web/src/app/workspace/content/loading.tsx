import { authorPublicationDeskCopy } from "../../../lib/author-publication-desk-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
export default async function AuthorPublicationLoading() {
  return (
    <p role="status" className="nexus-panel p-6 text-sm text-muted">
      {authorPublicationDeskCopy(await getRequestLocale()).loading}
    </p>
  );
}
