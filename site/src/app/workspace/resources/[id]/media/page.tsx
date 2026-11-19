import type { Metadata } from "next";
import { ResourceMediaScreen } from "../../../../../features/resources/media-server";
import { resourceMediaCopy } from "../../../../../features/resources/resource-media-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceMediaCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="min-w-0 overflow-x-clip">
      <ResourceMediaScreen productId={(await params).id} />
    </div>
  );
}
