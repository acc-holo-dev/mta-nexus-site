import {
  SalesHistoryScreen,
  salesHistoryMetadata,
} from "../../../features/commerce/sales-history-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => salesHistoryMetadata();
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  return SalesHistoryScreen({ query: await searchParams });
}
