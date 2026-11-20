import {
  ResourceMediaScreen,
  resourceMediaMetadata,
} from "../../../../../features/resources/media-server";
import { pageShellClip } from "../../../../../features/shell/page-shell";
export const dynamic = "force-dynamic";
export const generateMetadata = resourceMediaMetadata;
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className={pageShellClip}>
      <ResourceMediaScreen productId={(await params).id} />
    </div>
  );
}
