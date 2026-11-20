import type { Metadata } from "next";
import { ServerManagementScreen } from "../../../../features/servers/managed-server-workspace-server";
import { serverWorkspaceCopy } from "../../../../features/servers/server-workspace-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${serverWorkspaceCopy(await getRequestLocale()).managementDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return ServerManagementScreen(props);
}
