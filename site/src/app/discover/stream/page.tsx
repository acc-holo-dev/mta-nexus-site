import { discoveryStreamCopy } from "../../../features/discovery/discovery-stream-copy";
import { DiscoveryStreamPage } from "../../../features/discovery/discovery-stream-page-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const copy = discoveryStreamCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: "/discover/stream" },
  };
}

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return DiscoveryStreamPage(props);
}
