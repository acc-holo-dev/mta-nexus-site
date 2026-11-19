import type { Metadata } from "next";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export { ServersPage as default } from "../../features/servers/server";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).servers.title} | MTA NEXUS`,
  };
}
