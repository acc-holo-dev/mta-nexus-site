import {
  ResourceBuildScreen,
  resourceBuildMetadata,
} from "../../../../../../features/resources/build-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceBuildMetadata;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; buildId: string }>;
}) {
  const { id, buildId } = await params;
  return <ResourceBuildScreen productId={id} buildId={buildId} staff />;
}
