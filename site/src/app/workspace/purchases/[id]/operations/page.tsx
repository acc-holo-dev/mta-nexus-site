import {
  PurchaseOperationsScreen,
  purchaseOperationsMetadata,
} from "../../../../../features/commerce/purchase-operations-server";

export const dynamic = "force-dynamic";

export const generateMetadata = purchaseOperationsMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return PurchaseOperationsScreen({ params, searchParams });
}
