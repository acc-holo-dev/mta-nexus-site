import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { LegalDocument } from "../legal-document";
import { pageShellClip } from "../page-shell";

type LegalKind = "terms" | "privacy" | "copyright" | "communityRules";

async function legalDocumentMetadata(kind: LegalKind): Promise<Metadata> {
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

async function LegalDocumentPage({ kind }: { kind: LegalKind }) {
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
    <div className={pageShellClip}>
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

export const termsMetadata = () => legalDocumentMetadata("terms");
export const TermsDocumentPage = () => LegalDocumentPage({ kind: "terms" });

export const privacyMetadata = () => legalDocumentMetadata("privacy");
export const PrivacyDocumentPage = () => LegalDocumentPage({ kind: "privacy" });

export const copyrightMetadata = () => legalDocumentMetadata("copyright");
export const CopyrightDocumentPage = () => LegalDocumentPage({ kind: "copyright" });

export const communityRulesMetadata = () => legalDocumentMetadata("communityRules");
export const CommunityRulesDocumentPage = () => LegalDocumentPage({ kind: "communityRules" });
