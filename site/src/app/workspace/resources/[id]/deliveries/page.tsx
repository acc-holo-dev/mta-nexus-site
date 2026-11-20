import {
  PublisherDeliveriesScreen,
  publisherDeliveriesMetadata,
} from "../../../../../features/resources/publisher-deliveries-server";

export const dynamic = "force-dynamic";

export const generateMetadata = publisherDeliveriesMetadata;

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PublisherDeliveriesScreen(props);
}
