import type { Metadata } from "next";
import { ResourceBuildScreen } from "../../../../../../components/resource-build-screen";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { getResourceBuildWorkspaceCopy } from "../../../../../../lib/resource-build-workspace-i18n";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceBuildWorkspaceCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; buildId: string }>;
}) {
  const { id, buildId } = await params;
  return <ResourceBuildScreen productId={id} buildId={buildId} />;
}
