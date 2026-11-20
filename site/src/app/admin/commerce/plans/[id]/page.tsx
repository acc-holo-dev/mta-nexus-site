import {
  CommercialPlanAdminDetailScreen,
  commercialPlanAdminDetailMetadata,
} from "../../../../../features/commerce/commercial-plan-admin-detail-server";

export const dynamic = "force-dynamic";

export const generateMetadata = commercialPlanAdminDetailMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return CommercialPlanAdminDetailScreen({ params, searchParams });
}
