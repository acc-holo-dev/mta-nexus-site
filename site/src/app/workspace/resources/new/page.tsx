import type { Metadata } from "next";
import { ResourceCreateScreen } from "../../../../features/resources/resource-create-server";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).publishing.resourceTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page() {
  return ResourceCreateScreen();
}
