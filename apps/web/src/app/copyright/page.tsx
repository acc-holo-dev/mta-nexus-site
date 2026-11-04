import type { Metadata } from "next";
import { LegalDocument } from "../../components/legal-document";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return { title: getDictionary(locale).legal.copyright.metadataTitle };
}

export default async function CopyrightPage() {
  const locale = await getRequestLocale();
  const legal = getDictionary(locale).legal;
  const document = legal.copyright;

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
