import {
  PublisherAcquisitionsScreen,
  publisherAcquisitionsMetadata,
} from "../../../features/resources/publisher-acquisitions-server";

export const dynamic = "force-dynamic";

export const generateMetadata = publisherAcquisitionsMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; source?: string | string[] }>;
}) {
  return PublisherAcquisitionsScreen({ searchParams });
}
