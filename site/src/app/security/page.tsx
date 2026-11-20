import type { Metadata } from "next";
import { SecurityCenterScreen } from "../../features/accounts/security-center-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).securityCenter.title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page() {
  return SecurityCenterScreen();
}
