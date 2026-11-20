import type { Metadata } from "next";
import { ResourceCopiesScreen } from "../../../../../features/resources/resource-copies-server";
import { resourceCopyCopy } from "../../../../../features/resources/resource-copy-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCopyCopy(await getRequestLocale()).history} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourceCopiesScreen(props);
}
