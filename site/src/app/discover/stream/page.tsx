import {
  DiscoveryStreamPage,
  discoveryStreamMetadata,
} from "../../../features/discovery/discovery-stream-page-server";

export const dynamic = "force-dynamic";

export const generateMetadata = discoveryStreamMetadata;

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return DiscoveryStreamPage(props);
}
