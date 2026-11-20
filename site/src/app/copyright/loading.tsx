import { LegalDocumentRouteLoading } from "../../features/shell/legal-document-route-loading-server";

export default async function Loading() {
  return LegalDocumentRouteLoading({
    headingId: "copyright-loading-heading",
    titlePath: "legal.copyright.title",
    leading: (
      <>
        <div className="h-4 w-40 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ),
  });
}
