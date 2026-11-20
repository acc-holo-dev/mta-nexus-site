import type { Metadata } from "next";
import { getResourceActivityCopy } from "../../../../../features/resources/resource-activity-i18n";
import { ResourceActivityScreen } from "../../../../../features/resources/resource-activity-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceActivityCopy(await getRequestLocale()).analytics} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  return ResourceActivityScreen(props);
}
