import type { Metadata } from "next";
import { ResourceCompatibilityScreen } from "../../../../../features/resources/resource-compatibility-server";
import { getResourceManagementCopy } from "../../../../../features/resources/resource-management-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceManagementCopy(await getRequestLocale()).compatibility} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return ResourceCompatibilityScreen(props);
}
