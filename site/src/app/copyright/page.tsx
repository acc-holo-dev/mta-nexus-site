import {
  LegalDocumentPage,
  legalDocumentMetadata,
} from "../../features/shell/legal-document-page-server";

export const generateMetadata = () => legalDocumentMetadata("copyright");

export default async function Page() {
  return LegalDocumentPage({ kind: "copyright" });
}
