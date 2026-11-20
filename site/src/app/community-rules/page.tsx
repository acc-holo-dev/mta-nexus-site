import {
  LegalDocumentPage,
  legalDocumentMetadata,
} from "../../features/shell/legal-document-page-server";

export const generateMetadata = () => legalDocumentMetadata("communityRules");

export default async function Page() {
  return LegalDocumentPage({ kind: "communityRules" });
}
