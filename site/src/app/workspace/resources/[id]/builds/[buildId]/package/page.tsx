import type { Metadata } from "next";
import { buildPackageCopy } from "../../../../../../../features/resources/build-package-i18n";
import { BuildPackageScreen } from "../../../../../../../features/resources/package-server";
import { getRequestLocale } from "../../../../../../../lib/i18n/server";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${buildPackageCopy(await getRequestLocale()).inventory} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; buildId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, buildId } = await params;
  return (
    <div className="min-w-0 overflow-x-clip">
      <BuildPackageScreen productId={id} buildId={buildId} searchParams={searchParams} />
    </div>
  );
}
