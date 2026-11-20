import {
  ManagedServersScreen,
  managedServersMetadata,
} from "../../../features/servers/managed-servers-server";

export const dynamic = "force-dynamic";

export const generateMetadata = managedServersMetadata;

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ManagedServersScreen(props);
}
