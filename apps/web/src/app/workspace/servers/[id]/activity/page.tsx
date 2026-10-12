import type { Metadata } from "next";
import { ServerWorkspaceHistoryScreen } from "../../../../../components/server-workspace-history-screen";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getServerActivityCopy } from "../../../../../lib/server-activity-view";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getServerActivityCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function ServerActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerWorkspaceHistoryScreen({ id: (await params).id, searchParams });
}
