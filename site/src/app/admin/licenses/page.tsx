import type { Metadata } from "next";
import { getLicenseControlCopy } from "../../../features/commerce/license-control-i18n";
import { LicenseModerationScreen } from "../../../features/commerce/license-moderation-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseControlCopy(await getRequestLocale()).moderation} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  return LicenseModerationScreen({ searchParams });
}
