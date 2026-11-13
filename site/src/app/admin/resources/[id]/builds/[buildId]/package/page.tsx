import type { Metadata } from "next";
import { BuildPackageScreen } from "../../../../../../../components/build-package-screen";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review package files | MTA NEXUS",
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
  return (
    <div className={pageShellClass}>
      <BuildPackageScreen productId={id} buildId={buildId} searchParams={searchParams} staff />
    </div>
  );
}
