import {
  ResourcePublisherHistoryScreen,
  resourcePublisherHistoryMetadata,
} from "../../../../../features/resources/resource-publisher-history-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourcePublisherHistoryMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourcePublisherHistoryScreen(props);
}
