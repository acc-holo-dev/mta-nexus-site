import type { Metadata } from "next";
import { ResourceMediaScreen } from "../../../../../components/resource-media-screen";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review resource gallery | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ResourceMediaScreen productId={(await params).id} staff />;
}
