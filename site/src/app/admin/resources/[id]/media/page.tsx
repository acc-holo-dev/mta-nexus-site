import type { Metadata } from "next";
import { ResourceMediaScreen } from "../../../../../features/resources/media-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review resource gallery | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className={pageShellClass}>
      <ResourceMediaScreen productId={(await params).id} staff />
    </div>
  );
}
