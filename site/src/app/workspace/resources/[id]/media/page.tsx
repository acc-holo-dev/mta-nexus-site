import type { Metadata } from "next";
import { ResourceMediaScreen } from "../../../../../features/resources/media-server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resource gallery | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="min-w-0 overflow-x-clip">
      <ResourceMediaScreen productId={(await params).id} />
    </div>
  );
}
