import {
  SellerSalesReportDetailScreen,
  sellerSalesReportDetailMetadata,
} from "../../../../../features/commerce/seller-sales-report-detail-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sellerSalesReportDetailMetadata();
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return SellerSalesReportDetailScreen({ saleId: id, query });
}
