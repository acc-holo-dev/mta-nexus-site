import {
  ResourceBuildScreen,
  resourceBuildMetadata,
} from "../../../../../../features/resources/build-server";
import { pageShellClip } from "../../../../../../features/shell/page-shell";
export const dynamic = "force-dynamic";
export const generateMetadata = resourceBuildMetadata;
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; buildId: string }>;
}) {
  const { id, buildId } = await params;
  return (
    <div className={pageShellClip}>
      <ResourceBuildScreen productId={id} buildId={buildId} />
    </div>
  );
}
