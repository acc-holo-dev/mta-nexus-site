import type { Metadata } from "next";
import { ResourceManageScreen } from "../../../../features/resources/resource-manage-server";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).authorResources.manageDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function ManageResourcePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  return ResourceManageScreen(props);
}
