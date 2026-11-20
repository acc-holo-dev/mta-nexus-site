import {
  PlatformReportsScreen,
  platformReportsMetadata,
} from "../../../features/moderation/reports-server";

export const dynamic = "force-dynamic";

export const generateMetadata = platformReportsMetadata;

export default function PlatformReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PlatformReportsScreen searchParams={searchParams} />;
}
