import { LegalDocumentRouteLoading } from "../../features/shell/legal-document-route-loading-server";

export default async function Loading() {
  return LegalDocumentRouteLoading({
    headingId: "community-rules-loading-heading",
    titlePath: "legal.communityRules.title",
  });
}
