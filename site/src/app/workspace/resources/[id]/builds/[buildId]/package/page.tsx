import {
  BuildPackageScreen,
  buildPackageMetadata,
} from "../../../../../../../features/resources/package-server";
export const dynamic = "force-dynamic";
export const generateMetadata = buildPackageMetadata;
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
