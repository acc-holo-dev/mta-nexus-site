import type { Metadata } from "next";
import { getManagedServerCopy } from "../../../features/servers/managed-server-view";
import { ManagedServersScreen } from "../../../features/servers/managed-servers-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getManagedServerCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function ManagedServersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ManagedServersScreen(props);
}
