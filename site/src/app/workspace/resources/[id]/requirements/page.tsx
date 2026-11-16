import { ResourceRequirementsScreen } from "../../../../../features/resources/requirements-server";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  return (
    <div className="min-w-0 overflow-x-clip">
      {await ResourceRequirementsScreen({ productId: id, scope: "publisher", raw })}
    </div>
  );
}
