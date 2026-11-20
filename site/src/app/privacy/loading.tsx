import { LegalDocumentRouteLoading } from "../../features/shell/legal-document-route-loading-server";

export default async function Loading() {
  return LegalDocumentRouteLoading({
    headingId: "privacy-loading-heading",
    titlePath: "legal.privacy.title",
  });
}
