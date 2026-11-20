import {
  LicenseHistoryPage,
  licenseHistoryMetadata,
} from "../../../../../features/commerce/license-history-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => licenseHistoryMetadata();
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <LicenseHistoryPage moderation licenseId={id} query={query} />;
}
