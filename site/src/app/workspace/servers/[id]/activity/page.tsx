import {
  ServerWorkspaceHistoryScreen,
  serverWorkspaceHistoryMetadata,
} from "../../../../../features/servers/activity-server";

export const dynamic = "force-dynamic";

export const generateMetadata = serverWorkspaceHistoryMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerWorkspaceHistoryScreen({ id: (await params).id, searchParams });
}
