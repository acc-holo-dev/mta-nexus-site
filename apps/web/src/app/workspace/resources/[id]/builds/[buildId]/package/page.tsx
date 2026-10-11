import type { Metadata } from "next";
import { BuildPackageScreen } from "../../../../../../../components/build-package-screen";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Package files | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; buildId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, buildId } = await params;
  return <BuildPackageScreen productId={id} buildId={buildId} searchParams={searchParams} />;
}
