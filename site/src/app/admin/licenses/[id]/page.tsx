import type { Metadata } from "next";
import { getLicenseControlCopy } from "../../../../features/commerce/license-control-i18n";
import { LicenseModerationDetailScreen } from "../../../../features/commerce/license-moderation-detail-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseControlCopy(await getRequestLocale()).moderation} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return LicenseModerationDetailScreen({ params });
}
