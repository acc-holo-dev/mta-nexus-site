import {
  ServerPublicationHistoryScreen,
  serverPublicationHistoryMetadata,
} from "../../../../../../../features/servers/publication-history-server";

export const dynamic = "force-dynamic";

export const generateMetadata = serverPublicationHistoryMetadata;

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
