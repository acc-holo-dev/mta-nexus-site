import type { Metadata } from "next";
import { ResourcePublisherHistoryScreen } from "../../../../../features/resources/resource-publisher-history-server";
import { getResourcePublisherCopy } from "../../../../../features/resources/resource-publisher-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourcePublisherCopy(await getRequestLocale()).history} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourcePublisherHistoryScreen(props);
}
