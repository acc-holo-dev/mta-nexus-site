import type { Metadata } from "next";
import { ResourceRequirementsScreen } from "../../../../../features/resources/requirements-server";
import { resourceRequirementsCopy } from "../../../../../features/resources/resource-requirements-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceRequirementsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
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
