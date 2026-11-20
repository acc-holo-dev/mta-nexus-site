import {
  PurchasesHistoryScreen,
  purchasesHistoryMetadata,
} from "../../../features/commerce/purchases-history-server";

export const dynamic = "force-dynamic";

export const generateMetadata = purchasesHistoryMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return PurchasesHistoryScreen({ searchParams });
}
