import {
  PlatformReportsScreen,
  platformReportsMetadata,
} from "../../../../features/moderation/reports-server";

export const dynamic = "force-dynamic";

export const generateMetadata = platformReportsMetadata;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PlatformReportsScreen id={(await params).id} />;
}
