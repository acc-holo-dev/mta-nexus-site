import type { Metadata } from "next";
import { AuthorResourcesScreen } from "../../../features/resources/author-resources-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).authorResources.title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function AuthorResourcesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return AuthorResourcesScreen(props);
}
