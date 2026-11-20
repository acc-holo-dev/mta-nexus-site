import {
  PurchaseDetailScreen,
  purchaseDetailMetadata,
} from "../../../../features/commerce/purchase-detail-server";

export const dynamic = "force-dynamic";

export const generateMetadata = purchaseDetailMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return PurchaseDetailScreen({ params, searchParams });
}
