import {
  SellerSalesReportScreen,
  sellerSalesReportMetadata,
} from "../../../../features/commerce/seller-sales-report-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => sellerSalesReportMetadata();
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SellerSalesReportScreen({ query: await searchParams });
}
