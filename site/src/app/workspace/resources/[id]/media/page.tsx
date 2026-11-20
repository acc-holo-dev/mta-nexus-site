import {
  ResourceMediaScreen,
  resourceMediaMetadata,
} from "../../../../../features/resources/media-server";
export const dynamic = "force-dynamic";
export const generateMetadata = resourceMediaMetadata;
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="min-w-0 overflow-x-clip">
      <ResourceMediaScreen productId={(await params).id} />
    </div>
  );
}
