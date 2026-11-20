import {
  ServerDetailScreen,
  serverDetailMetadata,
} from "../../../features/servers/server-detail-server";

export const dynamic = "force-dynamic";
export const generateMetadata = serverDetailMetadata;

export default async function ServerDetailPage(props: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ history?: string | string[] }>;
}) {
  return ServerDetailScreen(props);
}
