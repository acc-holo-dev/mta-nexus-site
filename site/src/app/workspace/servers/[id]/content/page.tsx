import { ServerPublicationsScreen } from "../../../../../features/servers/publications-server";
import { serverContentCopy } from "../../../../../features/servers/server-content-copy";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: serverContentCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerPublicationsScreen(props);
}
