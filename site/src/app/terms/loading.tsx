import { LegalDocumentRouteLoading } from "../../features/shell/legal-document-route-loading-server";

export default async function Loading() {
  return LegalDocumentRouteLoading({
    headingId: "terms-loading-heading",
    titlePath: "legal.terms.title",
  });
}
