import { ResourceRequirementsScreen } from "../../../../../features/resources/requirements-server";

const pageShellClass = "min-w-0 overflow-x-clip";

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
    <div className={pageShellClass}>
      {await ResourceRequirementsScreen({ productId: id, scope: "moderator", raw })}
    </div>
  );
}
