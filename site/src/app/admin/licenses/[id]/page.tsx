import {
  LicenseModerationDetailScreen,
  licenseModerationDetailMetadata,
} from "../../../../features/commerce/license-moderation-detail-server";

export const dynamic = "force-dynamic";

export const generateMetadata = licenseModerationDetailMetadata;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return LicenseModerationDetailScreen({ params });
}
