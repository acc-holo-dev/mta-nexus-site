import type { Metadata } from "next";
import { PublisherAcquisitionsScreen } from "../../../features/resources/publisher-acquisitions-server";
import { getResourceActivityCopy } from "../../../features/resources/resource-activity-i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceActivityCopy(await getRequestLocale()).history} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; source?: string | string[] }>;
}) {
  return PublisherAcquisitionsScreen({ searchParams });
}
