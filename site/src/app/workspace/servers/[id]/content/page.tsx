import {
  ServerPublicationsScreen,
  serverPublicationsMetadata,
} from "../../../../../features/servers/publications-server";

export const dynamic = "force-dynamic";

export const generateMetadata = serverPublicationsMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ServerPublicationsScreen(props);
}
