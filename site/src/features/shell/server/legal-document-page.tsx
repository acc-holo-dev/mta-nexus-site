import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { LegalDocument } from "../legal-document";
import { pageShellClip as pageShellClass } from "../page-shell";

export type LegalKind = "terms" | "privacy" | "copyright" | "communityRules";

export async function legalDocumentMetadata(kind: LegalKind): Promise<Metadata> {
  const legal = getDictionary(await getRequestLocale()).legal;
  const title =
    kind === "terms"
      ? legal.terms.metadataTitle
      : kind === "privacy"
        ? legal.privacy.metadataTitle
        : kind === "copyright"
          ? legal.copyright.metadataTitle
          : legal.communityRules.metadataTitle;
  return { title };
}

export async function LegalDocumentPage({ kind }: { kind: LegalKind }) {
  const locale = await getRequestLocale();
  const legal = getDictionary(locale).legal;
  const document =
    kind === "terms"
      ? legal.terms
      : kind === "privacy"
        ? legal.privacy
        : kind === "copyright"
          ? legal.copyright
          : legal.communityRules;
  return (
    <div className={pageShellClass}>
      <LegalDocument
        badge={legal.openFreeBeta}
        title={document.title}
        lead={document.lead}
        lastUpdatedLabel={legal.lastUpdated}
        updated={document.updated}
        sections={document.sections}
        contactLabel={document.contactLabel}
        contactEmail={document.contactEmail}
      />
    </div>
  );
}
