import { ServerPublicationHistoryScreen } from "../../../../../../../components/server-publication-history-screen";
import { getRequestLocale } from "../../../../../../../lib/i18n-server";
import { serverPublicationHistoryCopy } from "../../../../../../../lib/server-publication-history-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = serverPublicationHistoryCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; contentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await params;
  return ServerPublicationHistoryScreen({ ...scope, searchParams });
}
