import {
  PurchaseTermsScreen,
  purchaseTermsMetadata,
} from "../../../../../features/commerce/purchase-terms-server";

export const dynamic = "force-dynamic";

export const generateMetadata = purchaseTermsMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return PurchaseTermsScreen({ params, searchParams });
}
