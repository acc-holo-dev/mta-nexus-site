import {
  LicenseHistoryPage,
  licenseHistoryMetadata,
} from "../../../../../features/commerce/license-history-server";

const pageShellClass = "min-w-0 overflow-x-clip";

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
  return (
    <div className={pageShellClass}>
      <LicenseHistoryPage moderation licenseId={id} query={query} />
    </div>
  );
}
