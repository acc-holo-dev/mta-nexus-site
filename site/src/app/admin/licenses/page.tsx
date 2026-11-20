import {
  LicenseModerationScreen,
  licenseModerationMetadata,
} from "../../../features/commerce/license-moderation-server";

export const dynamic = "force-dynamic";

export const generateMetadata = licenseModerationMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  return LicenseModerationScreen({ searchParams });
}
