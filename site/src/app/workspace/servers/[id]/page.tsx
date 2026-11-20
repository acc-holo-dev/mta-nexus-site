import {
  ServerManagementScreen,
  serverManagementMetadata,
} from "../../../../features/servers/managed-server-workspace-server";

export const dynamic = "force-dynamic";

export const generateMetadata = serverManagementMetadata;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return ServerManagementScreen(props);
}
