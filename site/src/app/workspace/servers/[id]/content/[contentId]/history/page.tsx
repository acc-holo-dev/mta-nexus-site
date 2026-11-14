import { ServerPublicationHistoryScreen } from "../../../../../../../features/servers/publication-history-server";
import { getRequestLocale } from "../../../../../../../lib/i18n-server";
import { serverPublicationHistoryCopy } from "../../../../../../../lib/server-publication-history-copy";

const pageShellClass = "min-w-0 overflow-x-clip";

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
  return (
    <div className={pageShellClass}>
      {await ServerPublicationHistoryScreen({ ...scope, searchParams })}
    </div>
  );
}
