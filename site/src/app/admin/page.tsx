import type { Metadata } from "next";
import { AdminHomeScreen } from "../../features/moderation/admin-home-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).admin.title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminPage(props: {
  searchParams: Promise<{
    reportView?: string;
    reportPage?: string;
    reportId?: string;
    verificationView?: string;
    verificationPage?: string;
    verificationId?: string;
    buildPage?: string;
    riskBuildPage?: string;
    contentPage?: string;
  }>;
}) {
  return AdminHomeScreen(props);
}
