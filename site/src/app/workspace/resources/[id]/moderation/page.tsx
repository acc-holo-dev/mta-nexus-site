import {
  ResourcePublisherModerationScreen,
  resourcePublisherModerationMetadata,
} from "../../../../../features/resources/resource-publisher-moderation-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourcePublisherModerationMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return ResourcePublisherModerationScreen(props);
}
